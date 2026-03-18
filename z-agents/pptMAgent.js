const { llmAgent } = require("../openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { buildRagContext } = require("../helpers/chat.helpers");
const presentationService = require("../services/presentation.service");

/**
 * Step 1: Plan the presentation - Get intro text and slide breakdown
 * @param {string} prompt - User's topic/prompt
 * @param {string} ragContext - Context from knowledge base
 * @param {number} numberOfPages - Number of content slides (1-5)
 * @returns {object} { introText, slideTopics: [{title, type, keyPoints}] }
 */
const planPresentation = async (prompt, ragContext, numberOfPages) => {
  console.log(`\n📋 Planning presentation: ${numberOfPages} slides`);

  const systemPrompt = `You are a presentation content strategist. Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Topic: ${prompt}

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

  const response = await llmAgent.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  try {
    const jsonMatch = (response.content || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON found");
  } catch {
    return {
      introText: `Exploring ${prompt.substring(0, 30)}`,
      slideTopics: Array.from({ length: numberOfPages }, (_, i) => ({
        title: `Key Topic ${i + 1}`,
        type: "info",
        keyPoints: ["Overview", "Details", "Summary"],
      })),
    };
  }
};

/**
 * Generate a single slide HTML with PwC branding
 * @param {object} params - Slide generation parameters
 * @returns {string} Generated HTML content
 */
const generateSlide = async ({ 
  slideTitle, 
  slideType, 
  ragContext = "",
  keyPoints = [],
  isIntro = false,
  isConclusion = false,
  introText = "",
  presentationName = "",
  presentationTopic = ""
}) => {
  const slideDesc = isIntro ? "Cover" : isConclusion ? "Conclusion" : slideType;
  console.log(`\n🎨 Generating ${slideDesc} slide: ${slideTitle}`);

  // Working public image URLs
  const PWC_LOGO = "https://crystalpng.com/wp-content/uploads/2025/05/pwc-logo.png";
  const getRandomImage = (seed) => `https://picsum.photos/seed/${seed}/400/300`;

  // PwC Brand Colors
  const PWC_ORANGE = "#E85825";
  const PWC_GRADIENT_COVER = "linear-gradient(135deg, #fff5f0 0%, #ffe4d9 50%, #ffd4c4 100%)";
  const PWC_GRADIENT_CONTENT = "linear-gradient(180deg, #fff9f7 0%, #ffede6 100%)";
  const PWC_GRADIENT_CONCLUSION = "linear-gradient(135deg, #fff8f5 0%, #ffe8df 50%, #ffddd1 100%)";
  const PWC_HEADER_BG = "linear-gradient(90deg, #2d3436 0%, #636e72 100%)";

  const systemPrompt = `You are an expert HTML slide designer creating MODERN, professional presentation slides with PwC brand styling.
Generate ONLY raw HTML (no markdown, no code fences).

DESIGN REQUIREMENTS:
- Exact size: 1280x720px (width:1280px; height:720px;)
- Use inline CSS styles only
- PwC BRAND COLORS: Orange (#E85825), light peach/coral gradients
- MODERN design with clean lines, subtle shadows
- Use modern fonts: 'Segoe UI', 'Inter', Arial, sans-serif
- Generate REAL, MEANINGFUL content (not Lorem Ipsum)
- Content must be VERTICALLY CENTERED within the slide
- Use flexbox for centering`;

  let contentInstruction;
  if (isIntro) {
    contentInstruction = `COVER SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENT_COVER}
- PwC Logo at top-left: <img src="${PWC_LOGO}" alt="PwC" style="position:absolute;top:30px;left:40px;height:60px;"/>
- Title: "${presentationName || slideTitle}" - Large (48-56px), bold, BLACK text (#2d3436), left-aligned at ~20% from top
- Tagline: "${introText}" - Smaller (20-24px), dark gray text below title
- Add orange parallelogram decorative elements (PwC style): two skewed rectangles in center-bottom area using: transform:skewX(-20deg); background:${PWC_ORANGE};
- Author "Presentation by [Name]" and "Date" at bottom-left in dark text
- Clean, corporate PwC look with peach/orange tones`;
  } else if (isConclusion) {
    contentInstruction = `CONCLUSION SLIDE - PwC BRANDED about "${presentationTopic}":
- Background: Very light peach gradient: ${PWC_GRADIENT_CONCLUSION}
- PwC Logo at top-right: <img src="${PWC_LOGO}" alt="PwC" style="position:absolute;top:30px;right:40px;height:50px;"/>
- Large "Thank You" heading - BLACK text (#2d3436), bold, 52px, centered
- Brief closing message below - dark gray text (#555), 20px, centered, max-width 900px
- "Questions?" at bottom center in dark text
- Keep text BLACK/dark since background is light
- Modern, clean design with PwC peach tones`;
  } else {
    const keyPointsText = keyPoints.length > 0 
      ? `\nKEY POINTS TO EXPAND INTO SECTIONS:\n${keyPoints.map((p, i) => `${i+1}. ${p}`).join('\n')}`
      : "";
    
    const contextText = ragContext ? `\nREFERENCE CONTEXT:\n${ragContext.substring(0, 800)}` : "";
    const imageUrl = getRandomImage(slideTitle.replace(/\s/g, '').substring(0, 10));
    
    contentInstruction = `${slideType.toUpperCase()} CONTENT SLIDE - PwC BRANDED:
- Background: PwC light peach gradient: ${PWC_GRADIENT_CONTENT}
- Title bar at top (height ~70px): Dark gradient ${PWC_HEADER_BG} with white title "${slideTitle}" (24px, bold, left-padded 40px)
- PwC Logo in title bar, right side: <img src="${PWC_LOGO}" alt="PwC" style="height:40px;margin-right:40px;"/>
- Main content area: VERTICALLY CENTERED using flexbox, padding: 40px
- Two-column layout: Left side = text content (55%), Right side = image (40%)
- Image: <img src="${imageUrl}" alt="${slideTitle}" style="width:380px;height:285px;object-fit:cover;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);"/>
${keyPointsText}
${contextText}
- Each content section: Bold header (18px, #2d3436) + 2-3 sentences of REAL content (15px, #555)
- Use white cards with subtle shadow (background:#fff; border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.08);)
- Spacing: 20px between cards
- Text color: BLACK/dark gray (NOT white)
- FORBIDDEN: Lorem ipsum, placeholder text, generic filler`;
  }

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`${contentInstruction}\n\nGenerate 1280x720px slide. Output ONLY <section> tag with inline styles.`)
  ];

  const response = await llmAgent.invoke(messages);
  let html = (response.content || "").replace(/```html?\n?/gi, "").replace(/```\n?/gi, "").trim();

  if (!html.toLowerCase().includes("<section")) {
    html = `<section style="width:1280px;height:720px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,#fff5f0 0%,#ffe4d9 50%,#ffd4c4 100%);font-family:'Segoe UI',Arial,sans-serif;padding:60px;box-sizing:border-box;color:#2d3436;">${html}</section>`;
  }

  return html;
};

/**
 * Wrap HTML content in complete document
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

/**
 * Main presentation generation workflow
 * Called asynchronously after initial API response
 */
const processPresentationRequest = async ({
  presentationId,
  name,
  prompt,
  numberOfPages,
  projectId,
  project,
}) => {
  const startTime = Date.now();

  try {
    console.log(`\n🎨 Starting presentation generation...`);
    console.log(`   Name: ${name}`);
    console.log(`   Topic: ${prompt.substring(0, 50)}...`);
    console.log(`   Pages: ${numberOfPages}`);

    // Step 1: Get RAG context
    let ragContext = "";
    if (project) {
      ragContext = await buildRagContext(project, prompt);
    }

    // Step 2: Plan presentation
    await presentationService.updatePresentationProgress(presentationId, "Planning presentation...");
    const plan = await planPresentation(prompt, ragContext, numberOfPages);
    console.log(`\n📝 Plan:`, JSON.stringify(plan, null, 2));

    // Step 3: Generate Cover Slide (use short name, not full prompt)
    await presentationService.updatePresentationProgress(presentationId, "Generating Cover Slide");
    const coverHtml = await generateSlide({
      slideTitle: prompt,
      slideType: "cover",
      isIntro: true,
      introText: plan.introText,
      presentationName: name,
    });
    await presentationService.addSlideToPresentation(presentationId, {
      slideName: "Cover",
      slideNumber: 1,
      slideType: "cover",
      content: wrapHtmlSlide(coverHtml, 1, "Cover"),
    });

    // Step 4: Generate Content Slides
    for (let i = 0; i < plan.slideTopics.length; i++) {
      const topic = plan.slideTopics[i];
      const slideNumber = i + 2;

      await presentationService.updatePresentationProgress(presentationId, `Generating Slide ${slideNumber}`);

      const slideHtml = await generateSlide({
        slideTitle: topic.title,
        slideType: topic.type,
        ragContext,
        keyPoints: topic.keyPoints || [],
        presentationTopic: prompt,
      });

      await presentationService.addSlideToPresentation(presentationId, {
        slideName: topic.title,
        slideNumber,
        slideType: topic.type,
        content: wrapHtmlSlide(slideHtml, slideNumber, topic.title),
      });
    }

    // Step 5: Generate Conclusion Slide
    const conclusionNumber = numberOfPages + 2;
    await presentationService.updatePresentationProgress(presentationId, "Generating Conclusion Slide");
    const conclusionHtml = await generateSlide({
      slideTitle: prompt,
      slideType: "conclusion",
      isConclusion: true,
      presentationTopic: prompt,
    });
    await presentationService.addSlideToPresentation(presentationId, {
      slideName: "Conclusion",
      slideNumber: conclusionNumber,
      slideType: "conclusion",
      content: wrapHtmlSlide(conclusionHtml, conclusionNumber, "Conclusion"),
    });

    // Step 6: Complete
    const generationTime = Date.now() - startTime;
    await presentationService.completePresentationGeneration(presentationId, generationTime);

    console.log(`\n✅ Presentation completed in ${generationTime}ms (${numberOfPages + 2} slides)`);
    return { success: true, message: `Generated ${numberOfPages + 2} slides` };

  } catch (error) {
    console.error("❌ Generation error:", error.message);
    await presentationService.updatePresentationStatus(presentationId, "error", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  processPresentationRequest,
  planPresentation,
  generateSlide,
};
