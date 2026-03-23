/**
 * Intent Classification Constants
 * 
 * Configuration for hybrid intent classification system.
 * Includes weighted keywords, confidence thresholds, and LLM fallback settings.
 */

const { RAG_INTENTS } = require("./rag-constants");

/**
 * Fallback LLM model for classification when confidence is low
 * Uses a fast/cheap model for quick classification
 */
const CLASSIFICATION_FALLBACK_MODEL = "gpt-4o-mini";

/**
 * Confidence threshold below which LLM fallback is triggered
 */
const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Minimum confidence to accept any classification
 */
const MIN_CONFIDENCE = 0.3;

/**
 * Weighted keyword patterns for intent detection
 * Higher weight = stronger signal for that intent
 * 
 * Structure: { keyword: weight }
 * Weight range: 0.1 (weak signal) to 1.0 (strong signal)
 */
const INTENT_KEYWORDS = {
  [RAG_INTENTS.READ]: {
    // Strong signals (0.8-1.0)
    "list": 0.9,
    "show": 0.85,
    "describe": 0.9,
    "summarize": 0.9,
    "summary": 0.9,
    "explain": 0.9,
    "what is": 0.85,
    "what are": 0.85,
    "how does": 0.8,
    "tell me about": 0.85,
    
    // Medium signals (0.5-0.7)
    "get": 0.6,
    "fetch": 0.7,
    "read": 0.7,
    "status": 0.7,
    "details": 0.6,
    "info": 0.6,
    "information": 0.6,
    
    // Weak signals (0.3-0.4)
    "issues": 0.4,
    "pull requests": 0.4,
    "prs": 0.4,
    "branches": 0.4,
  },

  [RAG_INTENTS.WRITE]: {
    // Strong signals (0.8-1.0)
    "update": 0.85,
    "modify": 0.85,
    "change": 0.8,
    "edit": 0.8,
    "push": 0.75,
    
    // Medium signals (0.5-0.7)
    "add": 0.6,
    "plan": 0.6,
    "sprint": 0.65,
    "milestone": 0.65,
    "epic": 0.5,
    "story": 0.5,
    "bug": 0.5,
    "task": 0.5,
  },

  [RAG_INTENTS.IMPLEMENTATION]: {
    // Strong signals (0.8-1.0)
    "implement": 0.95,
    "build": 0.85,
    "develop": 0.9,
    "write code": 0.95,
    "code this": 0.9,
    "create pr": 0.9,
    "open pr": 0.9,
    "make a pr": 0.85,
    
    // Medium signals (0.5-0.7)
    "fix": 0.7,
    "resolve": 0.7,
    "branch": 0.6,
    "feature": 0.55,
  },

  [RAG_INTENTS.GENERAL]: {
    // Catch-all patterns with low weight
    "help": 0.4,
    "can you": 0.3,
    "please": 0.2,
  },
};

/**
 * Negative keywords that reduce confidence for certain intents
 * Helps disambiguate queries like "show me how to implement" (read, not implementation)
 */
const NEGATIVE_KEYWORDS = {
  [RAG_INTENTS.IMPLEMENTATION]: [
    "how to",
    "show me how",
    "explain how",
    "what does",
    "describe how",
    "tutorial",
    "guide",
    "example of",
  ],
  [RAG_INTENTS.WRITE]: [
    "summary",
    "summarize",
    "list",
    "show",
  ],
};

/**
 * Keywords that boost confidence when combined with other keywords
 */
const BOOSTER_KEYWORDS = {
  [RAG_INTENTS.IMPLEMENTATION]: [
    "now",
    "immediately",
    "right away",
    "go ahead",
    "proceed",
    "issue #",
    "story #",
    "bug #",
  ],
  [RAG_INTENTS.READ]: [
    "all",
    "every",
    "which",
    "where",
  ],
};

/**
 * Classification prompt for LLM fallback
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for a software development AI assistant.

Classify the user's query into ONE of these intents:
- read: User wants information, explanations, lists, summaries, or to understand something
- write: User wants to create, update, or modify data/records (but not code implementation)
- implementation: User wants actual code written, features built, bugs fixed, or PRs created
- general: Unclear or conversational queries

IMPORTANT RULES:
1. "Show me how to implement X" = read (they want explanation, not code)
2. "Implement X" = implementation (they want actual code)
3. "Create a summary" = read (summary is reading/fetching data)
4. "Create an issue" = write (creating a record)
5. "Fix bug #123" = implementation (they want code fix)

Respond with ONLY a JSON object:
{"intent": "read|write|implementation|general", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

/**
 * Get all keywords for an intent (flat array)
 */
const getKeywordsForIntent = (intent) => {
  return Object.keys(INTENT_KEYWORDS[intent] || {});
};

/**
 * Get all intents
 */
const getAllIntents = () => Object.values(RAG_INTENTS);

module.exports = {
  CLASSIFICATION_FALLBACK_MODEL,
  CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE,
  INTENT_KEYWORDS,
  NEGATIVE_KEYWORDS,
  BOOSTER_KEYWORDS,
  CLASSIFICATION_SYSTEM_PROMPT,
  getKeywordsForIntent,
  getAllIntents,
};
