/**
 * LangGraph PPT Agent - Generates presentations with both HTML (preview) and native PPTX content
 * Uses a multi-node graph: Planner → SlideGenerator (loop) → Finalizer
 */

const { StateGraph, END, START, Annotation } = require("@langchain/langgraph");
const { createLlmForProject } = require("../openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { buildRagContext } = require("../helpers/chat.helpers");
const presentationService = require("../services/presentation.service");
const {
  generateCoverSlideJson,
  generateContentSlideJson,
  generateConclusionSlideJson,
  getTopicImage,
} = require("../helpers/pptxBuilder");

// ============================================
// STATE DEFINITION
// ============================================

const PPTAgentState = Annotation.Root({
  // Input
  presentationId: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  name: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  prompt: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  numberOfPages: Annotation({ reducer: (a, b) => b ?? a, default: () => 3 }),
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
// HELPER FUNCTIONS
// ============================================

/**
 * Generate HTML content for a slide using LLM
 */
const generateSlideHtml = async ({ slideTitle, slideType, ragContext, keyPoints, isIntro, isConclusion, introText, presentationName, presentationTopic, llm }) => {
  const PWC_LOGO = "https://crystalpng.com/wp-content/uploads/2025/05/pwc-logo.png";
  const PWC_ORANGE = "#E85825";
  const PWC_GRADIENT_COVER = "linear-gradient(135deg, #fff5f0 0%, #ffe4d9 50%, #ffd4c4 100%)";
  const PWC_GRADIENT_CONTENT = "linear-gradient(180deg, #fff9f7 0%, #ffede6 100%)";
  const PWC_GRADIENT_CONCLUSION = "linear-gradient(135deg, #fff8f5 0%, #ffe8df 50%, #ffddd1 100%)";
  const PWC_HEADER_BG = "linear-gradient(90deg, #2d3436 0%, #636e72 100%)";

  const systemPrompt = `You are an expert HTML slide designer creating MODERN, professional presentation slides with PwC brand styling.
Generate ONLY raw HTML (no markdown, no code fences).

DESIGN REQUIREMENTS:
- Exact size: 1280x720px (width:1280px; height:720px;)
- Use inline CSS styles only
- PwC BRAND COLORS: Orange (#E85825), light peach/coral gradients
- MODERN design with clean lines, subtle shadows
- Use modern fonts: 'Segoe UI', 'Inter', Arial, sans-serif
- Generate REAL, MEANINGFUL content (not Lorem Ipsum)
- Content must be VERTICALLY CENTERED within the slide
- Use flexbox for centering`;

  let contentInstruction;
  if (isIntro) {
    contentInstruction = `COVER SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENT_COVER}
- PwC Logo at top-left: <img src="${PWC_LOGO}" alt="PwC" style="position:absolute;top:30px;left:40px;height:60px;"/>
- Title: "${presentationName || slideTitle}" - Large (48-56px), bold, BLACK text (#2d3436), left-aligned at ~20% from top
- Tagline: "${introText}" - Smaller (20-24px), dark gray text below title
- Add orange parallelogram decorative elements (PwC style): two skewed rectangles in center-bottom area using: transform:skewX(-20deg); background:${PWC_ORANGE};
- Author "Presentation by [Name]" and "Date" at bottom-left in dark text
- Clean, corporate PwC look with peach/orange tones`;
  } else if (isConclusion) {
    contentInstruction = `CONCLUSION SLIDE - PwC BRANDED about "${presentationTopic}":
- Background: Very light peach gradient: ${PWC_GRADIENT_CONCLUSION}
- PwC Logo at top-right: <img src="${PWC_LOGO}" alt="PwC" style="position:absolute;top:30px;right:40px;height:50px;"/>
- Large "Thank You" heading - BLACK text (#2d3436), bold, 52px, centered
- Brief closing message below - dark gray text (#555), 20px, centered, max-width 900px
- "Questions?" at bottom center in dark text
- Keep text BLACK/dark since background is light
- Modern, clean design with PwC peach tones`;
  } else {
    const keyPointsText = keyPoints.length > 0 
      ? `\nKEY POINTS TO EXPAND INTO SECTIONS:\n${keyPoints.map((p, i) => `${i+1}. ${p}`).join('\n')}`
      : "";
    
    const contextText = ragContext ? `\nREFERENCE CONTEXT:\n${ragContext.substring(0, 800)}` : "";
    const imageUrl = getTopicImage(slideTitle);
    
    contentInstruction = `${slideType.toUpperCase()} CONTENT SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENT_CONTENT}
- Title bar at top (height ~70px): Dark gradient ${PWC_HEADER_BG} with white title "${slideTitle}" (24px, bold, left-padded 40px)
- PwC Logo in title bar, right side: <img src="${PWC_LOGO}" alt="PwC" style="height:40px;margin-right:40px;"/>
- Main content area: VERTICALLY CENTERED using flexbox, padding: 40px
- Two-column layout: Left side = text content (55%), Right side = image (40%)
- Image: <img src="${imageUrl}" alt="${slideTitle}" style="width:380px;height:285px;object-fit:cover;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);"/>
${keyPointsText}
${contextText}
- Each content section: Bold header (18px, #2d3436) + 2-3 sentences of REAL content (15px, #555)
- Use white cards with subtle shadow (background:#fff; border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.08);)
- Spacing: 20px between cards
- Text color: BLACK/dark gray (NOT white)
- FORBIDDEN: Lorem ipsum, placeholder text, generic filler`;
  }

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`${contentInstruction}\n\nGenerate 1280x720px slide. Output ONLY <section> tag with inline styles.`)
  ];

  const response = await llm.invoke(messages);
  let html = (response.content || "").replace(/```html?\n?/gi, "").replace(/```\n?/gi, "").trim();

  if (!html.toLowerCase().includes("<section")) {
    html = `<section style="width:1280px;height:720px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,#fff5f0 0%,#ffe4d9 50%,#ffd4c4 100%);font-family:'Segoe UI',Arial,sans-serif;padding:60px;box-sizing:border-box;color:#2d3436;">${html}</section>`;
  }

  return html;
};

/**
 * Wrap HTML content in complete document
 */
const wrapHtmlSlide = (htmlContent, slideNumber, slideName) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slide ${slideNumber}: ${slideName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;font-family:'Inter','Segoe UI',Arial,sans-serif}
    section{box-shadow:0 20px 60px rgba(0,0,0,0.4);border-radius:8px;overflow:hidden}
    img{max-width:100%}
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
};

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
      ragContext = await buildRagContext(state.project, state.prompt);
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

  const systemPrompt = `You are a presentation content strategist. Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Topic: ${state.prompt}

Context from knowledge base:
${state.ragContext || "No additional context available."}

Create a detailed outline for a ${state.numberOfPages}-slide presentation (excluding cover/conclusion).

Return JSON format:
{
  "introText": "A catchy 5-10 word tagline for the cover slide",
  "slideTopics": [
    {
      "title": "Short Slide Title (3-6 words)",
      "type": "info|process|timeline",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}

Rules:
- Exactly ${state.numberOfPages} items in slideTopics
- type: "info" for data/metrics/facts, "process" for workflows/steps, "timeline" for roadmaps/sequences
- Each slide must have 3 specific keyPoints with real content (not placeholders)
- Titles should be SHORT and engaging (3-6 words max)
- KeyPoints should be actual content that can be expanded`;

  const response = await state.llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  let plan;
  try {
    const jsonMatch = (response.content || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON found");
    }
  } catch {
    plan = {
      introText: `Exploring ${state.prompt.substring(0, 30)}`,
      slideTopics: Array.from({ length: state.numberOfPages }, (_, i) => ({
        title: `Key Topic ${i + 1}`,
        type: "info",
        keyPoints: ["Overview", "Details", "Summary"],
      })),
    };
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
    slideType = "cover";
    slideNumber = 1;
    isIntro = true;
  } else if (currentSlideIndex === totalSlides - 1) {
    // Conclusion slide
    slideName = "Conclusion";
    slideType = "conclusion";
    slideNumber = totalSlides;
    isConclusion = true;
  } else {
    // Content slide
    const topicIndex = currentSlideIndex - 1;
    const topic = plan.slideTopics[topicIndex];
    slideName = topic.title;
    slideType = topic.type || "content";
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
      author: "Team",
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
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
