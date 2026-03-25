/**
 * LangGraph PPT Agent - Generates presentations with both HTML (preview) and native PPTX content
 * Uses a multi-node graph: Initializer → Planner → SlideGenerator (loop) → Finalizer
 */

const { StateGraph, END, START, Annotation } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

// Internal imports
const { createLlmForProject } = require("../openai");
const { buildRagContext } = require("../helpers/chat.helpers");
const presentationService = require("../services/presentation.service");
const {
  generateCoverSlideJson,
  generateContentSlideJson,
  generateConclusionSlideJson,
  getTopicImage,
} = require("../helpers/pptxBuilder");

// Constants and helpers
const { PPT_DEFAULTS, SLIDE_TYPES } = require("../common/ppt-constants");
const {
  SYSTEM_PROMPTS,
  buildPlannerPrompt,
  buildFallbackPlan,
} = require("../helpers/pptAgentPrompts");
const {
  extractSearchQuery,
  generateSlideHtml,
  wrapHtmlSlide,
  parseJsonFromResponse,
  formatPresentationDate,
} = require("../helpers/pptAgentHelpers");

// ============================================
// STATE DEFINITION
// ============================================

const PPTAgentState = Annotation.Root({
  // Input
  presentationId: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  name: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  prompt: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  numberOfPages: Annotation({ reducer: (a, b) => b ?? a, default: () => PPT_DEFAULTS.NUMBER_OF_PAGES }),
  projectId: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  project: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Working state
  llm: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  ragContext: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  plan: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  currentSlideIndex: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),
  slides: Annotation({ reducer: (a, b) => [...(a || []), ...(b || [])], default: () => [] }),

  // Output
  error: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  completed: Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
});

// ============================================
// GRAPH NODES
// ============================================

/**
 * Node 1: Initialize - Set up LLM and get RAG context
 */
const initializeNode = async (state) => {
  console.log(`\n🎨 [PPT Agent] Initializing presentation generation...`);
  console.log(`   Name: ${state.name}`);
  console.log(`   Topic: ${state.prompt?.substring(0, 50)}...`);
  console.log(`   Pages: ${state.numberOfPages}`);

  const llm = createLlmForProject(state.project);

  let ragContext = "";
  if (state.project) {
    try {
      // Extract meaningful terms and use lower threshold for better code matching
      const searchQuery = extractSearchQuery(state.name, state.prompt);
      console.log(`   🔎 Search query: ${searchQuery.substring(0, 60)}...`);
      
      ragContext = await buildRagContext(state.project, searchQuery, {
        intent: "docgen", // Lower threshold (0.3) + more chunks for doc generation
        autoDetectRepo: true,
      });
    } catch (error) {
      console.warn(`   ⚠️ RAG context failed: ${error.message}`);
    }
  }

  await presentationService.updatePresentationProgress(state.presentationId, "Initializing...");

  return { llm, ragContext };
};

/**
 * Node 2: Planner - Create presentation outline
 */
const plannerNode = async (state) => {
  console.log(`\n📋 [PPT Agent] Planning presentation structure...`);

  await presentationService.updatePresentationProgress(state.presentationId, "Planning presentation...");

  const userPrompt = buildPlannerPrompt({
    prompt: state.prompt,
    ragContext: state.ragContext,
    numberOfPages: state.numberOfPages,
  });

  const response = await state.llm.invoke([
    new SystemMessage(SYSTEM_PROMPTS.PLANNER),
    new HumanMessage(userPrompt),
  ]);

  let plan = parseJsonFromResponse(response.content);

  if (!plan) {
    plan = buildFallbackPlan({
      prompt: state.prompt,
      numberOfPages: state.numberOfPages,
    });
  }

  // Add cover and conclusion to plan
  plan.totalSlides = state.numberOfPages + 2; // +cover +conclusion

  console.log(`   ✅ Plan created with ${plan.slideTopics.length} content slides`);

  return { plan, currentSlideIndex: 0 };
};

/**
 * Node 3: Slide Generator - Generate one slide at a time
 */
const slideGeneratorNode = async (state) => {
  const { plan, currentSlideIndex, presentationId, name, prompt, ragContext, llm } = state;
  const totalSlides = plan.totalSlides;

  let slideName, slideType, slideNumber, keyPoints = [];
  let isIntro = false, isConclusion = false;

  // Determine which slide to generate
  if (currentSlideIndex === 0) {
    // Cover slide
    slideName = "Cover";
    slideType = SLIDE_TYPES.COVER;
    slideNumber = 1;
    isIntro = true;
  } else if (currentSlideIndex === totalSlides - 1) {
    // Conclusion slide
    slideName = "Conclusion";
    slideType = SLIDE_TYPES.CONCLUSION;
    slideNumber = totalSlides;
    isConclusion = true;
  } else {
    // Content slide
    const topicIndex = currentSlideIndex - 1;
    const topic = plan.slideTopics[topicIndex];
    slideName = topic.title;
    slideType = topic.type || SLIDE_TYPES.CONTENT;
    slideNumber = currentSlideIndex + 1;
    keyPoints = topic.keyPoints || [];
  }

  console.log(`\n🎨 [PPT Agent] Generating slide ${slideNumber}/${totalSlides}: ${slideName}`);
  await presentationService.updatePresentationProgress(presentationId, `Generating Slide ${slideNumber}`);

  // Generate HTML content
  const htmlContent = await generateSlideHtml({
    slideTitle: slideName,
    slideType,
    ragContext: isIntro || isConclusion ? "" : ragContext,
    keyPoints,
    isIntro,
    isConclusion,
    introText: plan.introText,
    presentationName: name,
    presentationTopic: prompt,
    llm,
  });

  // Generate PPTX JSON content
  let pptxContent;
  if (isIntro) {
    pptxContent = generateCoverSlideJson({
      title: name,
      subtitle: plan.introText,
      author: PPT_DEFAULTS.AUTHOR,
      date: formatPresentationDate(),
    });
  } else if (isConclusion) {
    pptxContent = generateConclusionSlideJson({
      message: `Thank you for exploring "${prompt.substring(0, 50)}"`,
      presentationName: name,
    });
  } else {
    pptxContent = generateContentSlideJson({
      title: slideName,
      keyPoints,
      imageUrl: getTopicImage(slideName),
      slideNumber,
    });
  }

  // Save slide to database
  const slideData = {
    slideName,
    slideNumber,
    slideType,
    content: wrapHtmlSlide(htmlContent, slideNumber, slideName),
    pptxContent,
  };

  await presentationService.addSlideToPresentation(presentationId, slideData);

  console.log(`   ✅ Slide ${slideNumber} saved with both HTML and PPTX content`);

  return {
    slides: [slideData],
    currentSlideIndex: currentSlideIndex + 1,
  };
};

/**
 * Node 4: Finalizer - Mark presentation as complete
 */
const finalizerNode = async (state) => {
  const { presentationId, slides } = state;
  
  console.log(`\n✅ [PPT Agent] Finalizing presentation with ${slides.length} slides`);
  
  const startTime = Date.now();
  await presentationService.completePresentationGeneration(presentationId, startTime);
  
  console.log(`   ✅ Presentation marked as completed`);

  return { completed: true };
};

/**
 * Conditional edge: Check if more slides need to be generated
 */
const shouldContinueGenerating = (state) => {
  const { currentSlideIndex, plan, error } = state;
  
  if (error) return "finalizer";
  if (!plan) return "finalizer";
  if (currentSlideIndex < plan.totalSlides) return "slideGenerator";
  return "finalizer";
};

// ============================================
// BUILD GRAPH
// ============================================

const buildPPTAgentGraph = () => {
  const graph = new StateGraph(PPTAgentState)
    .addNode("initializer", initializeNode)
    .addNode("planner", plannerNode)
    .addNode("slideGenerator", slideGeneratorNode)
    .addNode("finalizer", finalizerNode)
    .addEdge(START, "initializer")
    .addEdge("initializer", "planner")
    .addEdge("planner", "slideGenerator")
    .addConditionalEdges("slideGenerator", shouldContinueGenerating, {
      slideGenerator: "slideGenerator",
      finalizer: "finalizer",
    })
    .addEdge("finalizer", END);

  return graph.compile();
};

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Process presentation request using LangGraph agent
 * @param {object} params - Presentation parameters
 */
const processPresentationWithAgent = async ({
  presentationId,
  name,
  prompt,
  numberOfPages,
  projectId,
  project,
}) => {
  console.log(`\n🚀 [PPT Agent] Starting LangGraph presentation generation...`);
  
  try {
    const agent = buildPPTAgentGraph();
    
    const initialState = {
      presentationId,
      name,
      prompt,
      numberOfPages,
      projectId,
      project,
    };

    // Run the graph
    const result = await agent.invoke(initialState);
    
    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`\n🎉 [PPT Agent] Presentation generation completed successfully!`);
    return result;
    
  } catch (error) {
    console.error(`\n❌ [PPT Agent] Error:`, error.message);
    
    await presentationService.updatePresentationStatus(
      presentationId,
      "error",
      error.message
    );
    
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  processPresentationWithAgent,
  buildPPTAgentGraph,
};
