/**
 * Delegation Tools
 * 
 * Tools for delegating tasks to marketplace agents via HTTP API calls.
 * Uses REST endpoints with contentProvided mode to pass content directly.
 * Subscription checks happen at the API middleware level.
 * 
 * Note: These tools generate auth tokens on-demand using the requester context,
 * making them compatible with both regular API calls and MCP tool invocations.
 */

const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { createAuthToken } = require("../helpers/tokenHelper");

// API base URL - use environment variable or default to localhost
const API_BASE_URL = process.env.HUB_BASE_URL || "http://localhost:5000/api";

/**
 * Generate auth token from requester object
 * Works with both req.user (Express) and MCP user context
 * 
 * @param {Object} requester - User object with id, username, email, role
 * @returns {string|null} JWT auth token or null if requester is invalid
 */
const generateTokenFromRequester = (requester) => {
  if (!requester || !requester.id) {
    // Try common variations of user ID field
    const userId = requester?._id || requester?.sub || requester?.userId;
    if (!userId) return null;
    
    // Normalize requester object for token generation
    return createAuthToken({
      id: userId,
      username: requester?.username || requester?.email || "unknown",
      email: requester?.email || "",
      role: requester?.role || "user",
    });
  }
  
  return createAuthToken(requester);
};

/**
 * Make an authenticated HTTP request to the API
 * 
 * @param {string} endpoint - API endpoint path
 * @param {Object} body - Request body
 * @param {string} authToken - Bearer token for authentication
 * @returns {Promise<Object>} Response data
 */
const makeApiRequest = async (endpoint, body, authToken) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle subscription required error (403 from requireSubscription middleware)
    if (response.status === 403 && data.requiresSubscription) {
      return {
        success: false,
        requiresSubscription: true,
        agentSlug: data.agentSlug,
        agentName: data.agentName,
        message: data.message || `Agent is not installed. Please install it from the Agent Marketplace.`,
      };
    }
    throw new Error(data.message || `API request failed with status ${response.status}`);
  }

  return data;
};

/**
 * Create a tool for delegating document generation to the Document Agent
 * 
 * @param {Object} project - Project object
 * @param {Object} requester - User/requester object for generating auth token
 * @returns {Tool} LangChain tool
 */
const createDelegateToDocumentAgentTool = (project, requester) => {
  return tool(
    async ({ documentName, documentType, content, description }) => {
      const projectId = String(project?._id || "").trim();
      
      if (!projectId) {
        return JSON.stringify({
          success: false,
          message: "Project context is required to generate documents",
        });
      }

      // Generate auth token from requester context
      const authToken = generateTokenFromRequester(requester);
      if (!authToken) {
        return JSON.stringify({
          success: false,
          message: "User context is required. Cannot authenticate API request.",
        });
      }

      try {
        // Build the document prompt from provided content
        const delegatedPrompt = buildDelegatedPrompt(documentType, content);

        // Call the Document API with contentProvided mode
        const result = await makeApiRequest("/documents", {
          name: documentName,
          prompt: delegatedPrompt,
          projectId,
          description: description || `Generated via Chat Agent delegation`,
          contentProvided: true,
          providedContent: content,
        }, authToken);

        // Handle subscription required response
        if (result.requiresSubscription) {
          return JSON.stringify({
            success: false,
            requiresSubscription: true,
            agentSlug: result.agentSlug || "doc-agent",
            agentName: result.agentName || "Document Agent",
            message: "📦 Document Agent is not installed. Please install it from the Agent Marketplace to generate documents. Go to Marketplace → Browse Agents → Document Agent → Install",
          });
        }

        return JSON.stringify({
          success: true,
          async: true,
          documentId: result.document?._id || result._id,
          documentName: documentName,
          message: `📄 Document generation started! "${documentName}" is being created. You can view it in the Documents tab once ready.`,
        });

      } catch (error) {
        console.error("Document delegation failed:", error);
        return JSON.stringify({
          success: false,
          message: `Failed to start document generation: ${error.message}`,
        });
      }
    },
    {
      name: "delegate_to_document_agent",
      description: `Delegate document generation to the Document Agent via API. Use this when the user wants to create a formal document from gathered information. The Document Agent will generate a professional markdown document asynchronously.

WHEN TO USE:
- User explicitly asks to "create a document", "generate a report", "make a spec"
- You have gathered enough information/data and user wants it formatted as a document
- User asks for sprint summary document, retrospective report, etc.

REQUIRED: You must provide the 'content' with all the information to include in the document. The Document Agent will NOT search for additional data - it uses only what you provide.

EXAMPLE:
If user says "Create a sprint summary document", first gather sprint data using JIRA tools, then call this with the gathered data as 'content'.`,
      schema: z.object({
        documentName: z.string().describe("Name/title for the document (e.g., 'Sprint 23 Summary Report')"),
        documentType: z.enum([
          "report",
          "specification", 
          "guide",
          "analysis",
          "summary",
          "retrospective",
          "meeting_notes",
          "release_notes",
          "technical_doc",
        ]).describe("Type of document to generate"),
        content: z.string().describe("The full content/data to include in the document. This should contain all the information gathered from other tools (JIRA data, analytics, etc.). The Document Agent uses ONLY this content - no additional searches."),
        description: z.string().optional().describe("Brief description of the document purpose"),
      }),
    }
  );
};

/**
 * Build a structured prompt for delegated document generation
 */
const buildDelegatedPrompt = (documentType, content) => {
  const typePrompts = {
    report: "Generate a professional report document",
    specification: "Generate a technical specification document",
    guide: "Generate a comprehensive guide document",
    analysis: "Generate an analysis document with insights",
    summary: "Generate a concise summary document",
    retrospective: "Generate a retrospective document",
    meeting_notes: "Generate formatted meeting notes",
    release_notes: "Generate release notes document",
    technical_doc: "Generate technical documentation",
  };

  const basePrompt = typePrompts[documentType] || typePrompts.report;

  return `${basePrompt}

=== CONTENT PROVIDED BY CHAT AGENT ===
${content}
=== END OF PROVIDED CONTENT ===

Generate a well-structured markdown document based on the content above.`;
};

/**
 * Create a tool for delegating presentation generation to the Presentation Agent
 * 
 * @param {Object} project - Project object
 * @param {Object} requester - User/requester object for generating auth token
 * @returns {Tool} LangChain tool
 */
const createDelegateToPresentationAgentTool = (project, requester) => {
  return tool(
    async ({ presentationName, slideCount, content, description }) => {
      const projectId = String(project?._id || "").trim();
      
      if (!projectId) {
        return JSON.stringify({
          success: false,
          message: "Project context is required to generate presentations",
        });
      }

      // Generate auth token from requester context
      const authToken = generateTokenFromRequester(requester);
      if (!authToken) {
        return JSON.stringify({
          success: false,
          message: "User context is required. Cannot authenticate API request.",
        });
      }

      try {
        // Determine number of slides (default 3-5 based on content length)
        const numberOfPages = slideCount || Math.min(5, Math.max(3, Math.ceil(content.length / 1000)));
        
        // Build the presentation prompt from provided content
        const delegatedPrompt = buildDelegatedPresentationPrompt(content);

        // Call the Presentation API with contentProvided mode
        const result = await makeApiRequest("/presentations", {
          name: presentationName,
          prompt: delegatedPrompt,
          numberOfPages,
          projectId,
          description: description || `Generated via Chat Agent delegation`,
          contentProvided: true,
          providedContent: content,
        }, authToken);

        // Handle subscription required response
        if (result.requiresSubscription) {
          return JSON.stringify({
            success: false,
            requiresSubscription: true,
            agentSlug: result.agentSlug || "ppt-agent",
            agentName: result.agentName || "Presentation Agent",
            message: "📦 Presentation Agent is not installed. Please install it from the Agent Marketplace to generate presentations. Go to Marketplace → Browse Agents → Presentation Agent → Install",
          });
        }

        return JSON.stringify({
          success: true,
          async: true,
          presentationId: result.presentation?._id || result._id,
          presentationName: presentationName,
          slideCount: numberOfPages,
          message: `🎨 Presentation generation started! "${presentationName}" with ${numberOfPages + 2} slides is being created. You can view it in the Presentations tab once ready.`,
        });

      } catch (error) {
        console.error("Presentation delegation failed:", error);
        return JSON.stringify({
          success: false,
          message: `Failed to start presentation generation: ${error.message}`,
        });
      }
    },
    {
      name: "delegate_to_presentation_agent",
      description: `Delegate presentation generation to the Presentation Agent via API. Use this when the user wants to create a slide deck/presentation from gathered information. The Presentation Agent will generate a professional slideshow asynchronously.

WHEN TO USE:
- User explicitly asks to "create a presentation", "make slides", "build a deck"
- You have gathered enough information/data and user wants it as slides
- User asks for sprint review presentation, project overview slides, etc.

REQUIRED: You must provide the 'content' with all the information to include in the slides. The Presentation Agent will NOT search for additional data - it uses only what you provide.

EXAMPLE:
If user says "Create a sprint review presentation", first gather sprint data using JIRA tools, then call this with the gathered data as 'content'.`,
      schema: z.object({
        presentationName: z.string().describe("Name/title for the presentation (e.g., 'Sprint 23 Review')"),
        slideCount: z.number().min(1).max(5).optional().describe("Number of content slides (1-5, default: auto based on content)"),
        content: z.string().describe("The full content/data to include in the presentation. This should contain all the information gathered from other tools (JIRA data, analytics, etc.). The Presentation Agent uses ONLY this content - no additional searches."),
        description: z.string().optional().describe("Brief description of the presentation purpose"),
      }),
    }
  );
};

/**
 * Build a structured prompt for delegated presentation generation
 */
const buildDelegatedPresentationPrompt = (content) => {
  return `Create a professional presentation based on the following content:

=== CONTENT PROVIDED BY CHAT AGENT ===
${content}
=== END OF PROVIDED CONTENT ===

Generate slides that effectively communicate the key points from the content above.`;
};

module.exports = {
  createDelegateToDocumentAgentTool,
  createDelegateToPresentationAgentTool,
  buildDelegatedPrompt,
  buildDelegatedPresentationPrompt,
};
