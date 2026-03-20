const { createLlmForProject } = require("../openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { buildRagContext } = require("../helpers/chat.helpers");
const documentService = require("../services/document.service");

/**
 * Step 1: Plan the document - outline sections
 */
const planDocument = async (prompt, ragContext, llm) => {
  console.log(`\n📋 Planning document for: ${prompt.substring(0, 50)}`);

  const systemPrompt = `You are a professional document strategist. Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Topic: ${prompt}

Context from knowledge base:
${ragContext?.substring(0, 3000) || "No additional context available."}

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
- 4 to 6 sections
- Each section must have 3-4 specific keyPoints with real content (not placeholders)
- Section titles should be clear and descriptive
- KeyPoints should be actual content that will be expanded into prose`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  try {
    const jsonMatch = (response.content || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON found");
  } catch {
    return {
      summary: `A comprehensive document on ${prompt.substring(0, 40)}`,
      sections: [
        { title: "Introduction", keyPoints: ["Overview", "Purpose", "Scope"] },
        { title: "Key Concepts", keyPoints: ["Definition", "Principles", "Framework"] },
        { title: "Implementation", keyPoints: ["Steps", "Process", "Execution"] },
        { title: "Conclusion", keyPoints: ["Summary", "Takeaways", "Next Steps"] },
      ],
    };
  }
};

/**
 * Step 2: Generate a single section as markdown
 */
const generateSection = async ({
  sectionTitle,
  keyPoints = [],
  ragContext = "",
  documentTopic = "",
  isIntro = false,
  isConclusion = false,
  summary = "",
  llm,
}) => {
  console.log(`\n✍️  Generating section: ${sectionTitle}`);

  const systemPrompt = `You are a professional technical writer. Generate document content in clean Markdown format.
Rules:
- Use proper Markdown: ## for section heading, ### for sub-headings, **bold**, bullet lists
- Generate REAL, MEANINGFUL content (not Lorem Ipsum or placeholders)
- Professional tone, concise and informative
- Output ONLY the markdown for this section, no preamble`;

  let instruction;

  if (isIntro) {
    instruction = `Generate an **Executive Summary / Introduction** section for a document titled "${documentTopic}".
Summary to expand on: "${summary}"
Include:
- Brief context and purpose of this document
- What the reader will learn
- Why this topic matters
Format as markdown starting with ## Introduction`;
  } else if (isConclusion) {
    instruction = `Generate a **Conclusion** section for a document titled "${documentTopic}".
Include:
- Key takeaways recap
- Recommended next steps
- Closing thoughts
Format as markdown starting with ## Conclusion`;
  } else {
    const keyPointsText = keyPoints.length > 0
      ? `\nExpand these key points into detailed prose:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";

    const contextText = ragContext ? `\nReference context:\n${ragContext.substring(0, 800)}` : "";

    instruction = `Generate a section titled "## ${sectionTitle}" for a document about "${documentTopic}".
${keyPointsText}
${contextText}
- Write 3-4 paragraphs of substantial, real content
- Use bullet lists or numbered lists where appropriate
- Include relevant details, facts, and actionable insights
- FORBIDDEN: Lorem ipsum, placeholder text, generic filler`;
  }

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(instruction),
  ]);

  return (response.content || "").trim();
};

/**
 * Main document generation workflow
 */
const processDocumentRequest = async ({ documentId, name, prompt, project }) => {
  const startTime = Date.now();

  try {
    console.log(`\n📄 Starting document generation...`);
    console.log(`   Name: ${name}`);
    console.log(`   Topic: ${prompt.substring(0, 50)}...`);

    // Create LLM for this project
    const llm = createLlmForProject(project);

    // Step 1: RAG context
    let ragContext = "";
    if (project) {
      ragContext = await buildRagContext(project, prompt);
    }

    // Step 2: Plan
    await documentService.updateDocumentProgress(documentId, "Planning document structure...");
    const plan = await planDocument(prompt, ragContext, llm);
    console.log(`\n📝 Plan:`, JSON.stringify(plan, null, 2));

    // Step 3: Build full markdown - start with title and intro
    await documentService.updateDocumentProgress(documentId, "Writing Introduction...");
    let fullMarkdown = `# ${name}\n\n`;

    const introMd = await generateSection({
      sectionTitle: "Introduction",
      isIntro: true,
      documentTopic: prompt,
      summary: plan.summary,
      llm,
    });
    fullMarkdown += introMd + "\n\n---\n\n";

    // Step 4: Generate each planned section
    for (let i = 0; i < plan.sections.length; i++) {
      const section = plan.sections[i];
      await documentService.updateDocumentProgress(documentId, `Writing Section ${i + 1}: ${section.title}`);

      const sectionMd = await generateSection({
        sectionTitle: section.title,
        keyPoints: section.keyPoints || [],
        ragContext,
        documentTopic: prompt,
        llm,
      });
      fullMarkdown += sectionMd + "\n\n---\n\n";
    }

    // Step 5: Conclusion
    await documentService.updateDocumentProgress(documentId, "Writing Conclusion...");
    const conclusionMd = await generateSection({
      sectionTitle: "Conclusion",
      isConclusion: true,
      documentTopic: prompt,
      llm,
    });
    fullMarkdown += conclusionMd + "\n";

    // Step 6: Save full content and complete
    await documentService.appendDocumentContent(documentId, fullMarkdown);
    const generationTime = Date.now() - startTime;
    await documentService.completeDocumentGeneration(documentId, generationTime);

    console.log(`\n✅ Document completed in ${generationTime}ms`);
    return { success: true, message: "Document generated successfully" };

  } catch (error) {
    console.error("❌ Document generation error:", error.message);
    await documentService.updateDocumentStatus(documentId, "error", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  processDocumentRequest,
  planDocument,
  generateSection,
};
