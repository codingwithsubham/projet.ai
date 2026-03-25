/**
 * PPT Agent Constants - Brand colors, gradients, and configuration for HTML slide generation
 */

// ============================================
// PWC BRAND COLORS (HTML/CSS format)
// ============================================

const PWC_COLORS = {
  ORANGE: "#E85825",
  DARK_TEXT: "#2d3436",
  GRAY_TEXT: "#555",
  LIGHT_GRAY: "#636e72",
  WHITE: "#fff",
};

// ============================================
// PWC BRAND GRADIENTS (CSS format)
// ============================================

const PWC_GRADIENTS = {
  COVER: "linear-gradient(135deg, #fff5f0 0%, #ffe4d9 50%, #ffd4c4 100%)",
  CONTENT: "linear-gradient(180deg, #fff9f7 0%, #ffede6 100%)",
  CONCLUSION: "linear-gradient(135deg, #fff8f5 0%, #ffe8df 50%, #ffddd1 100%)",
  HEADER: "linear-gradient(90deg, #2d3436 0%, #636e72 100%)",
  FALLBACK: "linear-gradient(135deg, #fff5f0 0%, #ffe4d9 50%, #ffd4c4 100%)",
};

// ============================================
// ASSETS
// ============================================

const PWC_ASSETS = {
  LOGO_URL: "https://crystalpng.com/wp-content/uploads/2025/05/pwc-logo.png",
};

// ============================================
// SLIDE DIMENSIONS
// ============================================

const SLIDE_DIMENSIONS = {
  WIDTH: 1280,
  HEIGHT: 720,
  WIDTH_PX: "1280px",
  HEIGHT_PX: "720px",
};

// ============================================
// DEFAULT VALUES
// ============================================

const PPT_DEFAULTS = {
  NUMBER_OF_PAGES: 3,
  FONT_FAMILY: "'Segoe UI', 'Inter', Arial, sans-serif",
  AUTHOR: "Team",
  RAG_CONTEXT_LIMIT: 800,
};

// ============================================
// QUERY EXTRACTION STOP WORDS
// ============================================

/**
 * Words to filter out when extracting search terms from user prompts
 * These are instruction words that don't help with semantic search
 */
const PPT_STOP_WORDS = [
  "let's", "lets", "please", "generate", "create", "write", "build", "make",
  "presentation", "ppt", "slide", "slides", "based", "using", "from", "the",
  "a", "an", "for", "on", "of", "this", "that", "with", "about", "want",
  "need", "can", "you", "i", "me", "help", "pages", "page"
];

// ============================================
// SLIDE TYPES
// ============================================

const SLIDE_TYPES = {
  COVER: "cover",
  CONTENT: "content",
  CONCLUSION: "conclusion",
  INFO: "info",
  PROCESS: "process",
  TIMELINE: "timeline",
};

// ============================================
// FONT SIZES
// ============================================

const FONT_SIZES = {
  TITLE_COVER: "48-56px",
  TITLE_CONTENT: "24px",
  TAGLINE: "20-24px",
  THANK_YOU: "52px",
  CONTENT_HEADER: "18px",
  CONTENT_BODY: "15px",
  CLOSING_MESSAGE: "20px",
};

// ============================================
// STYLE PRESETS
// ============================================

const STYLE_PRESETS = {
  CARD: "background:#fff; border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.08);",
  IMAGE: "width:380px; height:285px; object-fit:cover; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15);",
  LOGO_COVER: "position:absolute; top:30px; left:40px; height:60px;",
  LOGO_HEADER: "height:40px; margin-right:40px;",
  LOGO_CONCLUSION: "position:absolute; top:30px; right:40px; height:50px;",
};

module.exports = {
  PWC_COLORS,
  PWC_GRADIENTS,
  PWC_ASSETS,
  SLIDE_DIMENSIONS,
  PPT_DEFAULTS,
  SLIDE_TYPES,
  FONT_SIZES,
  STYLE_PRESETS,
  PPT_STOP_WORDS,
};
