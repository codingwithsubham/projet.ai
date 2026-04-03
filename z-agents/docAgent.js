/**
 * LangGraph Document Agent - Generates professional markdown documents
 * Uses a multi-node graph: Initializer → Planner → SectionGenerator (loop) → Finalizer
 */

const { StateGraph, END, START, Annotation } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

// Internal imports
const { createLlmForDocGen } = require("../openai");
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

// Retry helper for LLM calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const invokeWithRetry = async (llm, messages, retries = MAX_RETRIES) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await llm.invoke(messages);
    } catch (error) {
      const isRetryable = error.message?.includes('Abort') || 
                          error.message?.includes('timeout') ||
                          error.message?.includes('ECONNRESET') ||
                          error.code === 'ECONNRESET';
      
      if (isRetryable && attempt < retries) {
        console.warn(`   ⚠️ LLM call failed (attempt ${attempt}/${retries}): ${error.message}`);
        console.log(`   🔄 Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
};

// ============================================
// STATE DEFINITION
// ============================================

const DocAgentState = Annotation.Root({
  // Input
  documentId: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  name: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  prompt: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),
  project: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  
  // Delegation mode - content provided by another agent (skip RAG)
  delegated: Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
  delegatedContent: Annotation({ reducer: (a, b) => b ?? a, default: () => "" }),

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
 * Node 1: Initialize - Set up LLM and get RAG context (or use delegated content)
 */
const initializeNode = async (state) => {
  console.log(`\n📄 [Doc Agent] Initializing document generation...`);
  console.log(`   Name: ${state.name}`);
  console.log(`   Topic: ${state.prompt?.substring(0, 50)}...`);
  console.log(`   Mode: ${state.delegated ? "DELEGATED (skip RAG)" : "STANDARD (with RAG)"}`);

  const startTime = Date.now();
  const llm = createLlmForDocGen(state.project);

  let ragContext = "";
  
  // === DELEGATION MODE ===
  // When delegated, use content provided by the calling agent instead of RAG
  if (state.delegated && state.delegatedContent) {
    console.log(`   📦 Using delegated content (${state.delegatedContent.length} chars)`);
    ragContext = `=== CONTENT PROVIDED BY CHAT AGENT ===\n${state.delegatedContent}\n=== END OF PROVIDED CONTENT ===`;
  } 
  // === STANDARD MODE ===
  // Fetch context from RAG/vector store
  else if (state.project) {
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

  console.log(`   📝 Prompt length: ${userPrompt.length} chars`);

  const response = await invokeWithRetry(state.llm, [
    new SystemMessage(SYSTEM_PROMPTS.PLANNER),
    new HumanMessage(userPrompt),
  ]);

  let plan = parseJsonFromResponse(response.content);

  if (!plan) {
    console.log(`   ⚠️ Failed to parse plan, using fallback`);
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
 * @param {string} params.documentId - Document ID
 * @param {string} params.name - Document name
 * @param {string} params.prompt - Document prompt/topic
 * @param {object} params.project - Project object
 * @param {boolean} [params.delegated=false] - If true, skip RAG and use delegatedContent
 * @param {string} [params.delegatedContent=""] - Content provided by delegating agent
 */
const processDocumentWithAgent = async ({ documentId, name, prompt, project, delegated = false, delegatedContent = "" }) => {
  console.log(`\n🚀 [Doc Agent] Starting LangGraph document generation...`);
  console.log(`   Delegated mode: ${delegated}`);

  try {
    const agent = buildDocAgentGraph();

    const initialState = {
      documentId,
      name,
      prompt,
      project,
      delegated,
      delegatedContent,
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
