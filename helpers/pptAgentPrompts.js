/**
 * PPT Agent Prompts - System prompts and templates for presentation generation
 */

const {
  PWC_COLORS,
  PWC_GRADIENTS,
  PWC_ASSETS,
  SLIDE_DIMENSIONS,
  STYLE_PRESETS,
} = require("../common/ppt-constants");

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPTS = {
  SLIDE_DESIGNER: `You are an expert HTML slide designer creating MODERN, professional presentation slides with PwC brand styling.
Generate ONLY raw HTML (no markdown, no code fences).

DESIGN REQUIREMENTS:
- Exact size: ${SLIDE_DIMENSIONS.WIDTH}x${SLIDE_DIMENSIONS.HEIGHT}px (width:${SLIDE_DIMENSIONS.WIDTH_PX}; height:${SLIDE_DIMENSIONS.HEIGHT_PX};)
- Use inline CSS styles only
- PwC BRAND COLORS: Orange (${PWC_COLORS.ORANGE}), light peach/coral gradients
- MODERN design with clean lines, subtle shadows
- Use modern fonts: 'Segoe UI', 'Inter', Arial, sans-serif
- Generate REAL, MEANINGFUL content (not Lorem Ipsum)
- Content must be VERTICALLY CENTERED within the slide
- Use flexbox for centering`,

  PLANNER: `You are a presentation content strategist. Return ONLY valid JSON, no markdown.`,
};

// ============================================
// SLIDE CONTENT TEMPLATES
// ============================================

/**
 * Build cover slide instruction
 */
const buildCoverSlideInstruction = ({ presentationName, slideTitle, introText }) => {
  return `COVER SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENTS.COVER}
- PwC Logo at top-left: <img src="${PWC_ASSETS.LOGO_URL}" alt="PwC" style="${STYLE_PRESETS.LOGO_COVER}"/>
- Title: "${presentationName || slideTitle}" - Large (48-56px), bold, BLACK text (${PWC_COLORS.DARK_TEXT}), left-aligned at ~20% from top
- Tagline: "${introText}" - Smaller (20-24px), dark gray text below title
- Add orange parallelogram decorative elements (PwC style): two skewed rectangles in center-bottom area using: transform:skewX(-20deg); background:${PWC_COLORS.ORANGE};
- Author "Presentation by [Name]" and "Date" at bottom-left in dark text
- Clean, corporate PwC look with peach/orange tones`;
};

/**
 * Build conclusion slide instruction
 */
const buildConclusionSlideInstruction = ({ presentationTopic }) => {
  return `CONCLUSION SLIDE - PwC BRANDED about "${presentationTopic}":
- Background: Very light peach gradient: ${PWC_GRADIENTS.CONCLUSION}
- PwC Logo at top-right: <img src="${PWC_ASSETS.LOGO_URL}" alt="PwC" style="${STYLE_PRESETS.LOGO_CONCLUSION}"/>
- Large "Thank You" heading - BLACK text (${PWC_COLORS.DARK_TEXT}), bold, 52px, centered
- Brief closing message below - dark gray text (${PWC_COLORS.GRAY_TEXT}), 20px, centered, max-width 900px
- "Questions?" at bottom center in dark text
- Keep text BLACK/dark since background is light
- Modern, clean design with PwC peach tones`;
};

/**
 * Build content slide instruction
 */
const buildContentSlideInstruction = ({ slideTitle, slideType, keyPoints, ragContext, imageUrl }) => {
  const keyPointsText = keyPoints.length > 0
    ? `\nKEY POINTS TO EXPAND INTO SECTIONS:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";

  const contextText = ragContext ? `\nREFERENCE CONTEXT:\n${ragContext.substring(0, 800)}` : "";

  return `${slideType.toUpperCase()} CONTENT SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENTS.CONTENT}
- Title bar at top (height ~70px): Dark gradient ${PWC_GRADIENTS.HEADER} with white title "${slideTitle}" (24px, bold, left-padded 40px)
- PwC Logo in title bar, right side: <img src="${PWC_ASSETS.LOGO_URL}" alt="PwC" style="${STYLE_PRESETS.LOGO_HEADER}"/>
- Main content area: VERTICALLY CENTERED using flexbox, padding: 40px
- Two-column layout: Left side = text content (55%), Right side = image (40%)
- Image: <img src="${imageUrl}" alt="${slideTitle}" style="${STYLE_PRESETS.IMAGE}"/>
${keyPointsText}
${contextText}
- Each content section: Bold header (18px, ${PWC_COLORS.DARK_TEXT}) + 2-3 sentences of REAL content (15px, ${PWC_COLORS.GRAY_TEXT})
- Use white cards with subtle shadow (${STYLE_PRESETS.CARD})
- Spacing: 20px between cards
- Text color: BLACK/dark gray (NOT white)
- FORBIDDEN: Lorem ipsum, placeholder text, generic filler`;
};

/**
 * Build slide generation user prompt
 */
const buildSlideUserPrompt = (contentInstruction) => {
  return `${contentInstruction}\n\nGenerate ${SLIDE_DIMENSIONS.WIDTH}x${SLIDE_DIMENSIONS.HEIGHT}px slide. Output ONLY <section> tag with inline styles.`;
};

// ============================================
// PLANNER TEMPLATES
// ============================================

/**
 * Build planner prompt
 */
const buildPlannerPrompt = ({ prompt, ragContext, numberOfPages }) => {
  return `Topic: ${prompt}

Context from knowledge base:
${ragContext || "No additional context available."}

Create a detailed outline for a ${numberOfPages}-slide presentation (excluding cover/conclusion).

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
- Exactly ${numberOfPages} items in slideTopics
- type: "info" for data/metrics/facts, "process" for workflows/steps, "timeline" for roadmaps/sequences
- Each slide must have 3 specific keyPoints with real content (not placeholders)
- Titles should be SHORT and engaging (3-6 words max)
- KeyPoints should be actual content that can be expanded`;
};

/**
 * Build fallback plan when parsing fails
 */
const buildFallbackPlan = ({ prompt, numberOfPages }) => {
  return {
    introText: `Exploring ${prompt.substring(0, 30)}`,
    slideTopics: Array.from({ length: numberOfPages }, (_, i) => ({
      title: `Key Topic ${i + 1}`,
      type: "info",
      keyPoints: ["Overview", "Details", "Summary"],
    })),
  };
};

module.exports = {
  SYSTEM_PROMPTS,
  buildCoverSlideInstruction,
  buildConclusionSlideInstruction,
  buildContentSlideInstruction,
  buildSlideUserPrompt,
  buildPlannerPrompt,
  buildFallbackPlan,
};
