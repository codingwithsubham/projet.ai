/**
 * Document Agent Constants - Configuration and defaults for markdown document generation
 */

// ============================================
// SECTION TYPES
// ============================================

const SECTION_TYPES = {
  INTRO: "introduction",
  CONTENT: "content",
  CONCLUSION: "conclusion",
};

// ============================================
// DEFAULT VALUES
// ============================================

const DOC_DEFAULTS = {
  MIN_SECTIONS: 4,
  MAX_SECTIONS: 6,
  KEY_POINTS_PER_SECTION: 3,
  RAG_CONTEXT_LIMIT: 3000,
  SECTION_RAG_LIMIT: 800,
};

// ============================================
// DEFAULT FALLBACK PLAN
// ============================================

const FALLBACK_PLAN = {
  sections: [
    { title: "Introduction", keyPoints: ["Overview", "Purpose", "Scope"] },
    { title: "Key Concepts", keyPoints: ["Definition", "Principles", "Framework"] },
    { title: "Implementation", keyPoints: ["Steps", "Process", "Execution"] },
    { title: "Conclusion", keyPoints: ["Summary", "Takeaways", "Next Steps"] },
  ],
};

// ============================================
// MARKDOWN FORMATTING
// ============================================

const MARKDOWN_FORMAT = {
  SECTION_SEPARATOR: "\n\n---\n\n",
  FINAL_SEPARATOR: "\n",
  HEADING_LEVEL_1: "#",
  HEADING_LEVEL_2: "##",
  HEADING_LEVEL_3: "###",
};

// ============================================
// QUERY EXTRACTION STOP WORDS
// ============================================

/**
 * Words to filter out when extracting search terms from user prompts
 * These are instruction words that don't help with semantic search
 */
const DOC_STOP_WORDS = [
  "let's", "lets", "please", "generate", "create", "write", "build", "make",
  "document", "based", "using", "from", "the", "a", "an", "for", "on", "of",
  "this", "that", "with", "about", "want", "need", "can", "you", "i", "me",
  "help", "requirement", "requirements", "spec", "specification", "specifications",
  "brd", "prd", "srs", "technical", "business", "functional"
];

module.exports = {
  SECTION_TYPES,
  DOC_DEFAULTS,
  FALLBACK_PLAN,
  MARKDOWN_FORMAT,
  DOC_STOP_WORDS,
};
