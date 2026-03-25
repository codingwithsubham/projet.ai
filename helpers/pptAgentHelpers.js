/**
 * PPT Agent Helpers - Utility functions for presentation generation
 */

const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const {
  PWC_GRADIENTS,
  SLIDE_DIMENSIONS,
  PPT_DEFAULTS,
  PPT_STOP_WORDS,
} = require("../common/ppt-constants");
const {
  SYSTEM_PROMPTS,
  buildCoverSlideInstruction,
  buildConclusionSlideInstruction,
  buildContentSlideInstruction,
  buildSlideUserPrompt,
} = require("./pptAgentPrompts");
const { getTopicImage } = require("./pptxBuilder");

// ============================================
// QUERY EXTRACTION HELPERS
// ============================================

/**
 * Extract meaningful search terms from presentation name and prompt
 * Removes common instruction words to improve semantic search relevance
 * 
 * @param {string} name - Presentation name
 * @param {string} prompt - User prompt
 * @returns {string} Cleaned search query for RAG
 */
const extractSearchQuery = (name, prompt) => {
  const stopWords = new Set(PPT_STOP_WORDS);

  const combined = `${name} ${prompt}`.toLowerCase();
  const terms = combined
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 15);

  return terms.length > 0 ? terms.join(" ") : name;
};

// ============================================
// HTML GENERATION HELPERS
// ============================================

/**
 * Generate HTML content for a slide using LLM
 * @param {Object} params - Slide generation parameters
 * @returns {Promise<string>} Generated HTML content
 */
const generateSlideHtml = async ({
  slideTitle,
  slideType,
  ragContext,
  keyPoints,
  isIntro,
  isConclusion,
  introText,
  presentationName,
  presentationTopic,
  llm,
}) => {
  let contentInstruction;

  if (isIntro) {
    contentInstruction = buildCoverSlideInstruction({
      presentationName,
      slideTitle,
      introText,
    });
  } else if (isConclusion) {
    contentInstruction = buildConclusionSlideInstruction({
      presentationTopic,
    });
  } else {
    const imageUrl = getTopicImage(slideTitle);
    contentInstruction = buildContentSlideInstruction({
      slideTitle,
      slideType,
      keyPoints,
      ragContext,
      imageUrl,
    });
  }

  const messages = [
    new SystemMessage(SYSTEM_PROMPTS.SLIDE_DESIGNER),
    new HumanMessage(buildSlideUserPrompt(contentInstruction)),
  ];

  const response = await llm.invoke(messages);
  let html = cleanHtmlResponse(response.content || "");

  // Ensure valid section wrapper
  if (!html.toLowerCase().includes("<section")) {
    html = wrapInFallbackSection(html);
  }

  return html;
};

/**
 * Clean LLM HTML response by removing markdown code fences
 * @param {string} content - Raw LLM response
 * @returns {string} Cleaned HTML
 */
const cleanHtmlResponse = (content) => {
  return content
    .replace(/```html?\n?/gi, "")
    .replace(/```\n?/gi, "")
    .trim();
};

/**
 * Wrap content in a fallback section if no section tag found
 * @param {string} content - HTML content
 * @returns {string} Wrapped HTML section
 */
const wrapInFallbackSection = (content) => {
  return `<section style="width:${SLIDE_DIMENSIONS.WIDTH}px;height:${SLIDE_DIMENSIONS.HEIGHT}px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:${PWC_GRADIENTS.FALLBACK};font-family:${PPT_DEFAULTS.FONT_FAMILY};padding:60px;box-sizing:border-box;color:#2d3436;">${content}</section>`;
};

/**
 * Wrap HTML content in complete HTML document
 * @param {string} htmlContent - Slide HTML content
 * @param {number} slideNumber - Slide number
 * @param {string} slideName - Slide name/title
 * @returns {string} Complete HTML document
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
// DATE HELPERS
// ============================================

/**
 * Format current date for presentation
 * @returns {string} Formatted date string
 */
const formatPresentationDate = () => {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

module.exports = {
  extractSearchQuery,
  generateSlideHtml,
  cleanHtmlResponse,
  wrapInFallbackSection,
  wrapHtmlSlide,
  parseJsonFromResponse,
  formatPresentationDate,
};
