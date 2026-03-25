/**
 * LangGraph Document Agent - Generates professional markdown documents
 * Uses a multi-node graph: Initializer → Planner → SectionGenerator (loop) → Finalizer
 */

const { StateGraph, END, START, Annotation } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

// Internal imports
const { createLlmForProject } = require("../openai");
const { buildRagContext } = require("../helpers/chat.helpers");
const documentService = require("../services/document.service");

// Constants and helpers
const { SECTION_TYPES } = require("../common/doc-constants");
const {
  SYSTEM_PROMPTS,
  buildPlannerPrompt,
  buildFallbackPlanForTopic,
} = require("../helpers/docAgentPrompts");
const {
  extractSearchQuery,
  generateSectionMarkdown,
  buildDocumentTitle,
  getSectionSeparator,
  appendSection,
  parseJsonFromResponse,
  calculateTotalSections,
  getSectionDetails,
} = require("../helpers/docAgentHelpers");

// ============================================
// STATE DEFINITION
// ============================================

const DocAgentState = Annotation.Root({
  // Input
  documentId: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  name: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  prompt: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  project: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Working state
  llm: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  ragContext: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  plan: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  currentSectionIndex: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),
  markdownContent: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  startTime: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

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
  console.log(`\n📄 [Doc Agent] Initializing document generation...`);
  console.log(`   Name: ${state.name}`);
  console.log(`   Topic: ${state.prompt?.substring(0, 50)}...`);

  const startTime = Date.now();
  const llm = createLlmForProject(state.project);

  let ragContext = "";
  if (state.project) {
    try {
      // Use document name + prompt as query with lower threshold for better code matching
      // Extract key terms from name and prompt for semantic search
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

  await documentService.updateDocumentProgress(state.documentId, "Initializing...");

  return { llm, ragContext, startTime };
};

/**
 * Node 2: Planner - Create document outline
 */
const plannerNode = async (state) => {
  console.log(`\n📋 [Doc Agent] Planning document structure...`);

  await documentService.updateDocumentProgress(state.documentId, "Planning document structure...");

  const userPrompt = buildPlannerPrompt({
    prompt: state.prompt,
    ragContext: state.ragContext,
  });

  const response = await state.llm.invoke([
    new SystemMessage(SYSTEM_PROMPTS.PLANNER),
    new HumanMessage(userPrompt),
  ]);

  let plan = parseJsonFromResponse(response.content);

  if (!plan) {
    plan = buildFallbackPlanForTopic(state.prompt);
  }

  // Calculate total sections including intro and conclusion
  plan.totalSections = calculateTotalSections(plan);

  console.log(`   ✅ Plan created with ${plan.sections.length} content sections`);

  // Initialize markdown with document title
  const markdownContent = buildDocumentTitle(state.name);

  return { plan, currentSectionIndex: 0, markdownContent };
};

/**
 * Node 3: Section Generator - Generate one section at a time
 */
const sectionGeneratorNode = async (state) => {
  const { plan, currentSectionIndex, documentId, prompt, ragContext, llm, markdownContent } = state;
  const totalSections = plan.totalSections;

  // Get section details using helper
  const sectionDetails = getSectionDetails(currentSectionIndex, plan);
  const { title: sectionTitle, number: sectionNumber, isIntro, isConclusion, keyPoints } = sectionDetails;

  console.log(`\n✍️  [Doc Agent] Generating section ${sectionNumber}/${totalSections}: ${sectionTitle}`);
  await documentService.updateDocumentProgress(documentId, `Writing Section ${sectionNumber}: ${sectionTitle}`);

  // Generate section markdown
  const sectionMd = await generateSectionMarkdown({
    sectionTitle,
    keyPoints,
    ragContext: isIntro || isConclusion ? "" : ragContext,
    documentTopic: prompt,
    isIntro,
    isConclusion,
    summary: plan.summary,
    llm,
  });

  // Append to markdown content
  const separator = getSectionSeparator(currentSectionIndex, totalSections);
  const updatedMarkdown = appendSection(markdownContent, sectionMd, separator);

  console.log(`   ✅ Section ${sectionNumber} generated`);

  return {
    markdownContent: updatedMarkdown,
    currentSectionIndex: currentSectionIndex + 1,
  };
};

/**
 * Node 4: Finalizer - Save document and mark as complete
 */
const finalizerNode = async (state) => {
  const { documentId, markdownContent, startTime } = state;

  console.log(`\n✅ [Doc Agent] Finalizing document...`);

  // Save full content to database
  await documentService.appendDocumentContent(documentId, markdownContent);

  // Calculate generation time and complete
  const generationTime = Date.now() - startTime;
  await documentService.completeDocumentGeneration(documentId, generationTime);

  console.log(`   ✅ Document completed in ${generationTime}ms`);

  return { completed: true };
};

/**
 * Conditional edge: Check if more sections need to be generated
 */
const shouldContinueGenerating = (state) => {
  const { currentSectionIndex, plan, error } = state;

  if (error) return "finalizer";
  if (!plan) return "finalizer";
  if (currentSectionIndex < plan.totalSections) return "sectionGenerator";
  return "finalizer";
};

// ============================================
// BUILD GRAPH
// ============================================

const buildDocAgentGraph = () => {
  const graph = new StateGraph(DocAgentState)
    .addNode("initializer", initializeNode)
    .addNode("planner", plannerNode)
    .addNode("sectionGenerator", sectionGeneratorNode)
    .addNode("finalizer", finalizerNode)
    .addEdge(START, "initializer")
    .addEdge("initializer", "planner")
    .addEdge("planner", "sectionGenerator")
    .addConditionalEdges("sectionGenerator", shouldContinueGenerating, {
      sectionGenerator: "sectionGenerator",
      finalizer: "finalizer",
    })
    .addEdge("finalizer", END);

  return graph.compile();
};

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Process document request using LangGraph agent
 * @param {object} params - Document parameters
 */
const processDocumentWithAgent = async ({ documentId, name, prompt, project }) => {
  console.log(`\n🚀 [Doc Agent] Starting LangGraph document generation...`);

  try {
    const agent = buildDocAgentGraph();

    const initialState = {
      documentId,
      name,
      prompt,
      project,
    };

    // Run the graph
    const result = await agent.invoke(initialState);

    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`\n🎉 [Doc Agent] Document generation completed successfully!`);
    return { success: true, message: "Document generated successfully" };

  } catch (error) {
    console.error(`\n❌ [Doc Agent] Error:`, error.message);

    await documentService.updateDocumentStatus(
      documentId,
      "error",
      error.message
    );

    return { success: false, error: error.message };
  }
};

// Legacy function for backward compatibility
const processDocumentRequest = processDocumentWithAgent;

// ============================================
// EXPORTS
// ============================================

module.exports = {
  processDocumentWithAgent,
  processDocumentRequest, // backward compatibility
  buildDocAgentGraph,
};
