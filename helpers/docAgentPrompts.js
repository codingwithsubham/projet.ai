/**
 * Document Agent Prompts - System prompts and templates for document generation
 */

const { DOC_DEFAULTS, FALLBACK_PLAN } = require("../common/doc-constants");

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPTS = {
  TECHNICAL_WRITER: `You are a professional technical writer. Generate document content in clean Markdown format.
Rules:
- Use proper Markdown: ## for section heading, ### for sub-headings, **bold**, bullet lists
- Generate REAL, MEANINGFUL content (not Lorem Ipsum or placeholders)
- Professional tone, concise and informative
- Output ONLY the markdown for this section, no preamble`,

  PLANNER: `You are a professional document strategist. Return ONLY valid JSON, no markdown.`,
};

// ============================================
// SECTION CONTENT TEMPLATES
// ============================================

/**
 * Build introduction section instruction
 */
const buildIntroSectionInstruction = ({ documentTopic, summary }) => {
  return `Generate an **Executive Summary / Introduction** section for a document titled "${documentTopic}".
Summary to expand on: "${summary}"
Include:
- Brief context and purpose of this document
- What the reader will learn
- Why this topic matters
Format as markdown starting with ## Introduction`;
};

/**
 * Build conclusion section instruction
 */
const buildConclusionSectionInstruction = ({ documentTopic }) => {
  return `Generate a **Conclusion** section for a document titled "${documentTopic}".
Include:
- Key takeaways recap
- Recommended next steps
- Closing thoughts
Format as markdown starting with ## Conclusion`;
};

/**
 * Build content section instruction
 */
const buildContentSectionInstruction = ({ sectionTitle, keyPoints, ragContext, documentTopic }) => {
  const keyPointsText = keyPoints.length > 0
    ? `\nExpand these key points into detailed prose:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const contextText = ragContext
    ? `\nReference context:\n${ragContext.substring(0, DOC_DEFAULTS.SECTION_RAG_LIMIT)}`
    : "";

  return `Generate a section titled "## ${sectionTitle}" for a document about "${documentTopic}".
${keyPointsText}
${contextText}
- Write 3-4 paragraphs of substantial, real content
- Use bullet lists or numbered lists where appropriate
- Include relevant details, facts, and actionable insights
- FORBIDDEN: Lorem ipsum, placeholder text, generic filler`;
};

// ============================================
// PLANNER TEMPLATES
// ============================================

/**
 * Build planner prompt
 */
const buildPlannerPrompt = ({ prompt, ragContext }) => {
  return `Topic: ${prompt}

Context from knowledge base:
${ragContext?.substring(0, DOC_DEFAULTS.RAG_CONTEXT_LIMIT) || "No additional context available."}

Create a detailed outline for a professional document on this topic.

Return JSON format:
{
  "summary": "A concise 1-2 sentence overview of what this document covers",
  "sections": [
    {
      "title": "Section Title",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Rules:
- ${DOC_DEFAULTS.MIN_SECTIONS} to ${DOC_DEFAULTS.MAX_SECTIONS} sections
- Each section must have ${DOC_DEFAULTS.KEY_POINTS_PER_SECTION}-4 specific keyPoints with real content (not placeholders)
- Section titles should be clear and descriptive
- KeyPoints should be actual content that will be expanded into prose`;
};

/**
 * Build fallback plan when parsing fails
 */
const buildFallbackPlanForTopic = (prompt) => {
  return {
    summary: `A comprehensive document on ${prompt.substring(0, 40)}`,
    sections: [...FALLBACK_PLAN.sections],
  };
};

module.exports = {
  SYSTEM_PROMPTS,
  buildIntroSectionInstruction,
  buildConclusionSectionInstruction,
  buildContentSectionInstruction,
  buildPlannerPrompt,
  buildFallbackPlanForTopic,
};
