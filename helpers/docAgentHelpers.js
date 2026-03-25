/**
 * Document Agent Helpers - Utility functions for document generation
 */

const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { MARKDOWN_FORMAT, DOC_STOP_WORDS } = require("../common/doc-constants");
const {
  SYSTEM_PROMPTS,
  buildIntroSectionInstruction,
  buildConclusionSectionInstruction,
  buildContentSectionInstruction,
} = require("./docAgentPrompts");

// ============================================
// QUERY EXTRACTION HELPERS
// ============================================

/**
 * Extract meaningful search terms from document name and prompt
 * Removes common instruction words to improve semantic search relevance
 * 
 * @param {string} name - Document name (e.g., "Instamart BRD")
 * @param {string} prompt - User prompt (e.g., "Let's generate a Business Requirement document based on...")
 * @returns {string} Cleaned search query for RAG
 */
const extractSearchQuery = (name, prompt) => {
  const stopWords = new Set(DOC_STOP_WORDS);

  // Combine name and prompt, then extract meaningful terms
  const combined = `${name} ${prompt}`.toLowerCase();
  
  // Extract words, filter stop words, keep meaningful terms
  const terms = combined
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 15); // Limit to prevent overly long queries

  // If we have meaningful terms, use them; otherwise fall back to name
  return terms.length > 0 ? terms.join(" ") : name;
};

// ============================================
// MARKDOWN GENERATION HELPERS
// ============================================

/**
 * Generate a single section as markdown using LLM
 * @param {Object} params - Section generation parameters
 * @returns {Promise<string>} Generated markdown content
 */
const generateSectionMarkdown = async ({
  sectionTitle,
  keyPoints = [],
  ragContext = "",
  documentTopic = "",
  isIntro = false,
  isConclusion = false,
  summary = "",
  llm,
}) => {
  let instruction;

  if (isIntro) {
    instruction = buildIntroSectionInstruction({
      documentTopic,
      summary,
    });
  } else if (isConclusion) {
    instruction = buildConclusionSectionInstruction({
      documentTopic,
    });
  } else {
    instruction = buildContentSectionInstruction({
      sectionTitle,
      keyPoints,
      ragContext,
      documentTopic,
    });
  }

  const response = await llm.invoke([
    new SystemMessage(SYSTEM_PROMPTS.TECHNICAL_WRITER),
    new HumanMessage(instruction),
  ]);

  return (response.content || "").trim();
};

// ============================================
// MARKDOWN FORMATTING HELPERS
// ============================================

/**
 * Build document title heading
 * @param {string} name - Document name
 * @returns {string} Markdown title
 */
const buildDocumentTitle = (name) => {
  return `${MARKDOWN_FORMAT.HEADING_LEVEL_1} ${name}\n\n`;
};

/**
 * Get appropriate section separator
 * @param {number} currentIndex - Current section index
 * @param {number} totalSections - Total number of sections
 * @returns {string} Separator string
 */
const getSectionSeparator = (currentIndex, totalSections) => {
  return currentIndex < totalSections - 1
    ? MARKDOWN_FORMAT.SECTION_SEPARATOR
    : MARKDOWN_FORMAT.FINAL_SEPARATOR;
};

/**
 * Append section to markdown content
 * @param {string} currentContent - Existing markdown content
 * @param {string} sectionContent - New section content
 * @param {string} separator - Separator to use
 * @returns {string} Combined markdown content
 */
const appendSection = (currentContent, sectionContent, separator) => {
  return currentContent + sectionContent + separator;
};

// ============================================
// JSON PARSING HELPERS
// ============================================

/**
 * Parse JSON from LLM response
 * @param {string} content - LLM response content
 * @returns {Object|null} Parsed JSON or null
 */
const parseJsonFromResponse = (content) => {
  try {
    const jsonMatch = (content || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch {
    return null;
  }
};

// ============================================
// PLAN HELPERS
// ============================================

/**
 * Calculate total sections including intro and conclusion
 * @param {Object} plan - Document plan
 * @returns {number} Total section count
 */
const calculateTotalSections = (plan) => {
  return (plan.sections?.length || 0) + 2; // +intro +conclusion
};

/**
 * Determine section details by index
 * @param {number} index - Current section index
 * @param {Object} plan - Document plan
 * @returns {Object} Section details
 */
const getSectionDetails = (index, plan) => {
  const totalSections = calculateTotalSections(plan);

  if (index === 0) {
    return {
      title: "Introduction",
      number: 1,
      isIntro: true,
      isConclusion: false,
      keyPoints: [],
    };
  }

  if (index === totalSections - 1) {
    return {
      title: "Conclusion",
      number: totalSections,
      isIntro: false,
      isConclusion: true,
      keyPoints: [],
    };
  }

  const planIndex = index - 1;
  const section = plan.sections[planIndex];
  return {
    title: section.title,
    number: index + 1,
    isIntro: false,
    isConclusion: false,
    keyPoints: section.keyPoints || [],
  };
};

module.exports = {
  extractSearchQuery,
  generateSectionMarkdown,
  buildDocumentTitle,
  getSectionSeparator,
  appendSection,
  parseJsonFromResponse,
  calculateTotalSections,
  getSectionDetails,
};
