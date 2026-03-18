const THEME_STYLES = {
  "PwC Design 1": {
    primaryColor: "#0066CC",
    secondaryColor: "#FF6600",
    backgroundColor: "#F5F5F5",
    fontFamily: "Arial, sans-serif",
    accentColor: "#FFB81C",
  },
  "PwC Design 2": {
    primaryColor: "#1F3864",
    secondaryColor: "#EC971F",
    backgroundColor: "#FFFFFF",
    fontFamily: "Courier New, monospace",
    accentColor: "#A7A9AC",
  },
  "PwC Design 3": {
    primaryColor: "#2E5090",
    secondaryColor: "#00B050",
    backgroundColor: "#E8F0F8",
    fontFamily: "Georgia, serif",
    accentColor: "#F0AD4E",
  },
  "PwC Design 4": {
    primaryColor: "#704214",
    secondaryColor: "#70AD47",
    backgroundColor: "#FFF2CC",
    fontFamily: "Verdana, sans-serif",
    accentColor: "#8B6F47",
  },
};

/**
 * Get template-based design patterns for each template type
 * Maps template filenames to specific design patterns and guidelines
 * @returns {object} Template patterns mapped to design instructions
 */
const getTemplatePatterns = () => {
  return {
    "cover_template.png": {
      name: "Cover Template",
      description: "Professional cover/title slide design",
      patterns: [
        "Large prominent centered title with emoji",
        "Subtitle or tagline below title",
        "Background gradient from primary to secondary color",
        "Visual separator line or decorative element at top",
        "Optional: Company/project name at bottom",
        "Use shadows for depth on text elements",
      ],
      emojiSuggestions: ["📘 for topics", "🎯 for goals", "🏢 for organizations"],
      examples: `
        Layout: Center-aligned content with vertical spacing
        Typography: Bold large title (48-64px), semi-bold subtitle (24-32px)
        Decoration: Horizontal lines, corner accents, gradient backgrounds
      `,
    },
    "content_template.png": {
      name: "Content Template",
      description: "Main content slide with text and visual hierarchy",
      patterns: [
        "Title with emoji at top (left-aligned or centered)",
        "Multiple content sections with visual separation",
        "Bullet points with emoji/icon prefixes",
        "Color-coded sections or badges",
        "Sidebar or grid layout for organization",
        "Icons next to each section header",
      ],
      emojiSuggestions: ["✓ for completed items", "▶ for steps", "📌 for key points", "⭐ for highlights"],
      examples: `
        Layout: Title + 2-3 content columns with spacing
        Typography: Semi-bold headers, regular body text
        Decoration: Colored boxes, dividers, bullet point icons, background panels
      `,
    },
    "timeline_template.png": {
      name: "Timeline Template",
      description: "Sequential timeline or process flow presentation",
      patterns: [
        "Horizontal or vertical timeline structure",
        "Numbered steps or phases (1️⃣ 2️⃣ 3️⃣)",
        "Connect elements with lines or arrows (→ or ↓)",
        "Time periods or phase labels",
        "Description under each timeline item",
        "Progress indicators or badges",
      ],
      emojiSuggestions: ["📅 for dates", "🔄 for cycles", "⏳ for time", "🎬 for phases"],
      examples: `
        Layout: Horizontal timeline with connected boxes or vertical sequence
        Typography: Bold phase names, regular descriptions
        Decoration: Connecting lines, numbered badges, color coding for phases
      `,
    },
    "process_template.png": {
      name: "Process Template",
      description: "Process or workflow diagram with steps",
      patterns: [
        "Step-by-step process flow with arrows/connectors",
        "Icons for each process step",
        "Clear input/output indicators",
        "Decision points or branching logic",
        "Numbered or emoji-marked steps",
        "Color gradients for process stages",
      ],
      emojiSuggestions: ["➡️ for flow", "⚙️ for processes", "🎯 for outcomes", "🔀 for decisions"],
      examples: `
        Layout: Left-to-right or top-to-bottom flow with connecting arrows
        Typography: Bold step names, smaller descriptions
        Decoration: Arrow connectors, circular badges, color-coded stages
      `,
    },
    "info_template.png": {
      name: "Info Template",
      description: "Information display with facts, figures, and data",
      patterns: [
        "Title with info icon 'ℹ️'",
        "Key metrics or statistics highlighted",
        "Icons next to each information block",
        "Color-coded information categories",
        "Clean white space for readability",
        "Emphasis on numbers with larger font sizes",
      ],
      emojiSuggestions: ["📊 for data", "💰 for financial", "📈 for growth", "👥 for people"],
      examples: `
        Layout: Info blocks in grid or table-like structure
        Typography: Large bold numbers, smaller descriptive text
        Decoration: Colored background boxes, icon bullets, subtle borders
      `,
    },
  };
};

/**
 * Build catchy design instruction with template patterns and visual enhancements
 * Prioritizes template-based design patterns over generic UI styling
 * @param {string} theme - Theme name
 * @param {string} designTemplate - Optional design template type (e.g., "cover_template.png")
 * @returns {string} Enhanced design instruction for LLM with template patterns
 */
const buildDesignInstruction = (theme, designTemplate = "") => {
  const templatePatterns = getTemplatePatterns();
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES["PwC Design 1"];
  
  let instruction = `🎨 CATCHY & PROFESSIONAL DESIGN REQUIREMENTS - Make presentations visually stunning and memorable!

DESIGN FOUNDATION - DO NOT use generic UI templates:
✓ Base your design on the VISUAL PATTERN TEMPLATES provided below
✓ Use real visual elements, not placeholder layouts
✓ Create MEMORABLE and ENGAGING slides
✗ Do NOT pull styling from standard UI components
✗ Do NOT use default presentation templates

EMOJI & VISUAL ENHANCEMENTS (MANDATORY - Make it Catchy!):
🎯 Strategic Emoji Usage:
   - EVERY title must have a relevant emoji at the start
   - Use category emojis: 📊 data, 💡 ideas, 🚀 growth, 📈 trends, 🎯 goals, ⭐ highlights
   - Use action emojis: ✓ done, ▶ process, ➡️ flow, 🔄 cycle, 📌 pin
   - Use domain emojis: 💰 finance, 👥 people, 🏢 organization, 📱 tech
   
🎨 Visual Separators & Patterns:
   - Horizontal dividers between sections (use border-top with gradient or shadow)
   - Vertical accent lines on left side (using border-left with theme accent color)
   - Decorative corner elements (subtle gradients, rounded corner accents)
   - Background patterns using CSS gradients (diagonal lines, subtle textures)
   - Color-blocked background sections for visual interest
   
🌈 Color & Styling Strategy:
   - Primary Color: ${themeStyle.primaryColor} (use for main titles, emphasis)
   - Secondary Color: ${themeStyle.secondaryColor} (use for accents, highlights, dividers)
   - Accent Color: ${themeStyle.accentColor} (use for decorative elements, special emphasis)
   - Create gradients mixing primary + secondary colors for backgrounds
   - Use transparency/opacity for layering (rgba colors)
   - Add text shadows for depth: text-shadow: 0 2px 4px rgba(0,0,0,0.2)
   
✨ Typography & Visual Hierarchy:
   - Bold, stand-out titles with emoji (font-weight: bold, font-size: 44-56px)
   - Semi-bold section headers (32-40px) with different color
   - Regular body text (16-18px) with good line-height (1.6-1.8)
   - Use different font weights and sizes to create hierarchy
   - Add subtle text shadows or glows on important elements
`;

  if (designTemplate && templatePatterns[designTemplate]) {
    const template = templatePatterns[designTemplate];
    instruction += `
📋 TEMPLATE PATTERN: ${template.name}
${template.description}

LAYOUT PATTERNS TO FOLLOW:
${template.patterns.map(p => `  • ${p}`).join('\n')}

EMOJI SUGGESTIONS FOR THIS TEMPLATE:
${template.emojiSuggestions.map(e => `  • ${e}`).join('\n')}

LAYOUT EXAMPLE:
${template.examples}
`;
  }

  instruction += `
🎨 UNIVERSAL CATCHY DESIGN ELEMENTS (Use Multiple):

Emoji Bullet Strategy:
  ✓ Instead of • Point 1, use: ✓ Point 1 or ⭐ Point 1 or 🎯 Point 1
  ✓ Each bullet should have emoji prefix matching content type
  ✓ Vary the emojis - don't repeat the same emoji multiple times

Visual Separators & Decoration:
  ✓ Add colored horizontal lines (2-4px height) between sections
  ✓ Use border-bottom with gradient: linear-gradient(to right, primary 0%, secondary 100%)
  ✓ Add vertical accent bars on left (border-left: 4px solid accent)
  ✓ Corner decorations using CSS (::before/::after pseudo-elements or divs)
  ✓ Subtle background patterns using radial-gradient or multiple linear-gradients
  ✓ Semi-transparent background panels for text blocks

Badges & Highlights:
  ✓ Create colored badge elements (display: inline-block with padding, background)
  ✓ Add emphasis boxes with different background colors
  ✓ Use box-shadow for depth: 0 4px 8px rgba(0,0,0,0.1)
  ✓ Round corners on important elements (border-radius: 8-12px)

Icons & Visual Structure:
  ✓ Emoji icons before section titles
  ✓ Number badges: ① ② ③ or 🔴 🟠 🟡 for steps
  ✓ Status indicators: ✅ ⚠️ ❌ 📍 for important info
  ✓ Directional indicators: ➡️ ↓ ↔️ for flow

Grid & Layout:
  ✓ Use flexbox or grid layout for organized content
  ✓ Create 2-3 column layouts for balanced design
  ✓ Add consistent spacing (gaps: 20px, 30px) between elements
  ✓ Align content vertically and horizontally centered where appropriate
  ✓ Use padding strategically (40-60px) for breathing room

HTML STRUCTURE TEMPLATE:
<section style="
  width: 1280px;
  height: 720px;
  background: linear-gradient(135deg, ${themeStyle.primaryColor} 0%, ${themeStyle.backgroundColor} 100%);
  padding: 60px;
  font-family: ${themeStyle.fontFamily};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
">
  <!-- Add decorative elements here -->
  <div style="position: absolute; top: 0; left: 0; width: 8px; height: 100%; background: ${themeStyle.secondaryColor}; opacity: 0.5;"></div>
  
  <!-- Main content -->
  <div style="text-align: center; position: relative; z-index: 1;">
    <h1 style="
      color: white;
      font-size: 52px;
      font-weight: bold;
      margin-bottom: 20px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">🎯 Your Title With Emoji</h1>
    
    <div style="
      height: 3px;
      width: 150px;
      background: linear-gradient(to right, ${themeStyle.secondaryColor}, ${themeStyle.accentColor});
      margin: 20px auto 30px;
    "></div>
    
    <!-- Content sections -->
    <div style="display: flex; gap: 30px; justify-content: center;">
      <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; border-left: 4px solid ${themeStyle.secondaryColor};">
        <p style="color: white; font-size: 18px;">✓ Point 1</p>
      </div>
      <!-- Repeat for more points -->
    </div>
  </div>
</section>

CRITICAL CHECKLIST FOR CATCHY DESIGN:
✅ Every title starts with relevant emoji
✅ Multiple visual separators (lines, borders, backgrounds)
✅ Color accents throughout (not just plain backgrounds)
✅ Proper spacing and breathing room (padding, margins, gaps)
✅ Text hierarchy with size and weight variations
✅ Emoji bullets on all lists
✅ Gradient backgrounds (not flat colors)
✅ At least one decorative visual element per slide
✅ Consistent theme color usage throughout
✅ Professional yet visually engaging appearance`;

  return instruction;
};

/**
 * Build complete presentation prompt asking LLM to generate ALL slides including intro and thank you
 * Uses template patterns for consistent, catchy design across all slides
 * @param {string} userPrompt - User's presentation request
 * @param {string} ragContext - Context from RAG/Vector DB
 * @param {number} numberOfPages - Exact number of CONTENT pages (not including intro/thank you)
 * @param {string} theme - Theme name with color scheme
 * @param {string} designTemplate - Optional design template type (e.g., "cover_template.png")
 * @returns {string} Complete prompt for LLM to generate all slides with template-based design
 */
const buildCompletePresentationPrompt = (userPrompt, ragContext, numberOfPages, theme, designTemplate = "") => {
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES["PwC Design 1"];
  const designInstructions = buildDesignInstruction(theme, designTemplate);
  
  return `You are an expert PowerPoint presentation designer creating VISUALLY STUNNING, CATCHY presentations using design templates.

🎯 DESIGN PHILOSOPHY:
- DO NOT use generic UI templates or standard presentation styles
- BASE your design on PROFESSIONAL VISUAL PATTERNS provided below
- Make every slide MEMORABLE, ENGAGING, and CATCHY
- Use TEMPLATES as your design foundation, not as constraints
- Prioritize VISUAL APPEAL with emojis, colors, and creative layouts

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${numberOfPages + 2} complete HTML sections:
   - Slide 1: INTRODUCTION slide (eye-catching, professional, memorable)
   - Slides 2-${numberOfPages + 1}: CONTENT slides (using consistent visual patterns)
   - Slide ${numberOfPages + 2}: THANK YOU slide (professional closing)
   
2. Each section MUST be:
   - Complete standalone HTML with inline CSS styles
   - EXACTLY 1280×720 pixels
   - No <!DOCTYPE> or <html> wrappers
   - Professionally designed with CATCHY visual elements
   - Using theme colors strategically throughout

THEME SPECIFICATIONS:
- Primary Color: ${themeStyle.primaryColor} (main titles, emphasis)
- Secondary Color: ${themeStyle.secondaryColor} (accents, highlights)
- Background Color: ${themeStyle.backgroundColor} (base layer)
- Accent Color: ${themeStyle.accentColor} (decorative elements)
- Font Family: ${themeStyle.fontFamily} (consistent typography)

${designInstructions}

📄 INTRODUCTION SLIDE DESIGN:
Topic: "${userPrompt.substring(0, 100).trim()}..."

Requirements:
✓ Large, bold title with relevant emoji (48-56px, bold)
✓ Subtitle or tagline (24-32px, semi-bold)
✓ Eye-catching background: gradient from primary to secondary color
✓ Visual decorative elements: lines, shapes, or patterns
✓ Text should have shadow for depth
✓ Center-aligned content with proper spacing
✓ Professional yet visually engaging design

Design Elements:
- Use gradient background: linear-gradient(135deg, ${themeStyle.primaryColor} 0%, ${themeStyle.backgroundColor} 100%)
- Add separator line (2-4px, gradient or solid)
- Include border accent (colored vertical or horizontal line)
- Add subtle shadow on text elements
- Use rounded corners on background elements
- Create visual depth with layering

📊 CONTENT SLIDES (${numberOfPages} slides total):
User Request: ${userPrompt}

Knowledge Base: ${ragContext}

For EACH content slide, create:
✓ Title with relevant emoji (40-48px, bold, primary color)
✓ Separator line below title (gradient, 2px height)
✓ Structured content using one of these patterns:
  - Bulleted list with emoji prefixes
  - 2-3 column grid layout
  - Timeline or numbered steps
  - Information cards with colors
  - Process flow with arrows

✓ Visual hierarchy:
  - Headers: 32-40px, semi-bold, primary/secondary color
  - Body: 16-18px, regular, dark/gray color
  - Line height: 1.6-1.8 for readability

✓ Catchy design elements (MUST include at least 3):
  - Emoji icons before each list item or section
  - Colored background panels or card-style boxes
  - Vertical accent border on left side (4px, secondary color)
  - Horizontal dividers between sections
  - Number badges or step indicators
  - Color-coded importance levels
  - Gradient text or text shadows
  - Icon decorations or visual separators

✓ Keep consistency:
  - Same color scheme throughout
  - Same emoji style/category
  - Same layout pattern as other slides
  - Professional spacing and alignment

🙏 THANK YOU/CLOSING SLIDE:
Requirements:
✓ Large "Thank You" heading with emoji (🙏 or 👏 or 🎉)
✓ Professional closing message
✓ Contact or call-to-action prompt
✓ Visual design matches presentation theme
✓ Similar gradient and decorative elements as intro
✓ Elegant and professional appearance

HTML LAYOUT TEMPLATES (Adapt as needed):

TITLE STYLE:
<h1 style="
  color: ${themeStyle.primaryColor};
  font-size: 52px;
  font-weight: bold;
  margin: 0 0 20px 0;
  text-shadow: 0 2px 8px rgba(0,0,0,0.2);
  text-align: center;
">🎯 Title With Emoji</h1>

SEPARATOR:
<div style="
  height: 3px;
  width: 200px;
  background: linear-gradient(to right, ${themeStyle.secondaryColor}, ${themeStyle.accentColor});
  margin: 20px auto;
"></div>

ACCENT BORDER LEFT:
<div style="
  border-left: 4px solid ${themeStyle.secondaryColor};
  padding: 20px 0 20px 20px;
  margin: 15px 0;
">
  [CONTENT HERE]
</div>

COLORED BOX:
<div style="
  background: rgba(${parseInt(themeStyle.secondaryColor.slice(1,3), 16)}, ${parseInt(themeStyle.secondaryColor.slice(3,5), 16)}, ${parseInt(themeStyle.secondaryColor.slice(5,7), 16)}, 0.1);
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid ${themeStyle.secondaryColor};
  margin: 15px 0;
">
  [CONTENT HERE]
</div>

EMOJI BULLET LIST:
<ul style="list-style: none; padding: 0;">
  <li style="margin: 12px 0; font-size: 18px;">✓ Point with emoji</li>
  <li style="margin: 12px 0; font-size: 18px;">🎯 Another point</li>
  <li style="margin: 12px 0; font-size: 18px;">⭐ Highlighted point</li>
</ul>

GRID LAYOUT (3 COLUMNS):
<div style="
  display: flex;
  gap: 20px;
  justify-content: space-between;
  margin: 30px 0;
">
  <div style="flex: 1; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
    [COLUMN 1]
  </div>
  <div style="flex: 1; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
    [COLUMN 2]
  </div>
  <div style="flex: 1; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
    [COLUMN 3]
  </div>
</div>

STEP/TIMELINE:
<div style="display: flex; align-items: center; gap: 15px; margin: 12px 0;">
  <div style="
    background: ${themeStyle.secondaryColor};
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  ">1️⃣</div>
  <div>Step description here</div>
</div>

IMPORTANT CATCHY DESIGN CHECKLIST:
✅ Every slide has emojis in titles and content
✅ Multiple visual separators (lines, borders, panels)
✅ Color variety using primary, secondary, and accent colors
✅ Proper spacing and breathing room (40-60px padding)
✅ Text hierarchy: bold titles, semi-bold headers, regular body
✅ Emoji bullets on all list items
✅ Gradient or multi-color backgrounds (not flat)
✅ Decorative elements (borders, shadows, rounded corners)
✅ Professional but visually engaging throughout
✅ Consistent design pattern across all slides
✅ Good contrast between text and background
✅ Readable fonts with proper sizes (16-18px minimum body text)

OUTPUT FORMAT:
⚠️ IMPORTANT: Separate each complete slide section with this exact delimiter:
===SLIDE===

Do NOT include the delimiter in the HTML content itself.

Generate all ${numberOfPages + 2} slides NOW:
1. Introduction slide
2-${numberOfPages + 1}. ${numberOfPages} content slides with consistent catchy design
${numberOfPages + 2}. Thank you slide

Each slide separated by ===SLIDE===`;
};

/**
 * Extract complete presentation sections including intro and thank you from LLM
 * @param {string} response - LLM response containing all slide sections
 * @returns {array} Array of all HTML section strings (intro + content + thank you)
 */
const extractCompletePresentationSections = (response) => {
  const sections = [];
  
  // Split by delimiter
  const delimiter = "===SLIDE===";
  if (response.includes(delimiter)) {
    const parts = response.split(delimiter);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        sections.push(trimmed);
      }
    }
    return sections;
  }

  // Fallback: Look for section tags
  const sectionRegex = /<section[^>]*>[\s\S]*?<\/section>/gi;
  const sectionMatches = response.match(sectionRegex);
  
  if (sectionMatches && sectionMatches.length > 0) {
    return sectionMatches.map(section => section.trim());
  }
  
  // Fallback: Look for div tags with style
  const divRegex = /<div[^>]*style[^>]*>[\s\S]*?<\/div>/gi;
  const divMatches = response.match(divRegex);
  
  if (divMatches && divMatches.length > 0) {
    return divMatches.map(div => div.trim());
  }
  
  if (response.trim().length > 0) {
    return [response.trim()];
  }
  
  return [];
};

/**
 * Build prompt for raw HTML generation (legacy - kept for backward compatibility)
 * @param {string} userPrompt - User's presentation request
 * @param {string} ragContext - Context from RAG/Vector DB
 * @param {number} numberOfPages - Exact number of content pages to generate
 * @param {string} theme - Theme name with color scheme
 * @returns {string} Enhanced prompt for HTML generation
 */
const buildRawHTMLPresentationPrompt = (userPrompt, ragContext, numberOfPages, theme) => {
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES["PwC Design 1"];
  
  return `You are an expert HTML/CSS designer creating professional presentation slides.

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${numberOfPages} unique content HTML sections (DO NOT include intro or thank you slide)
2. Each section must be a complete, standalone HTML div with inline CSS styles
3. Dimensions: EXACTLY 1280x720 pixels
4. Use the theme colors below for professional design

THEME COLORS (Use these in your design):
- Primary Color: ${themeStyle.primaryColor}
- Secondary Color: ${themeStyle.secondaryColor}
- Background Color: ${themeStyle.backgroundColor}
- Accent Color: ${themeStyle.accentColor}
- Font Family: ${themeStyle.fontFamily}

CONTENT REQUEST:
${userPrompt}

CONTEXT FROM KNOWLEDGE BASE:
${ragContext}

HTML STRUCTURE:
Each section should be a complete <div> or <section> with:
- Inline style attribute with ALL styling (no <style> tags)
- Width: 1280px, Height: 720px
- Professional layout with clear hierarchy
- Use the theme colors naturally throughout
- Include title, bullet points or content sections
- Padding and proper spacing for readability

OUTPUT FORMAT:
Generate raw HTML sections separated by a delimiter. Each section should look like:
<section style="...complete styling...">
  <div style="...">
    <h1 style="color: ${themeStyle.primaryColor}; ...">Title</h1>
    <div style="...">
      <p style="color: ${themeStyle.primaryColor};">Content</p>
    </div>
  </div>
</section>

IMPORTANT: 
- Do NOT wrap in <!DOCTYPE> or <html> tags
- Each section must be a standalone block
- Use consistent styling across all sections
- Make content professional and engaging
- Ensure readability with proper contrast using theme colors

Now generate ${numberOfPages} unique content sections:`;
};

/**
 * Extract HTML sections from LLM response
 * Parses the response to find individual HTML sections
 * @param {string} response - LLM response containing HTML sections
 * @returns {array} Array of HTML section strings
 */
const extractHTMLSections = (response) => {
  const sections = [];
  
  // Look for section tags
  const sectionRegex = /<section[^>]*>[\s\S]*?<\/section>/gi;
  const sectionMatches = response.match(sectionRegex);
  
  if (sectionMatches && sectionMatches.length > 0) {
    return sectionMatches.map(section => section.trim());
  }
  
  // Fallback: Look for div sections
  const divRegex = /<div[^>]*style[^>]*>[\s\S]*?<\/div>/gi;
  const divMatches = response.match(divRegex);
  
  if (divMatches && divMatches.length > 0) {
    return divMatches.map(div => div.trim());
  }
  
  // If no sections found, treat entire response as one section
  if (response.trim().length > 0) {
    return [response.trim()];
  }
  
  return [];
};

/**
 * Generate intro slide HTML
 * @param {string} theme - Theme name
 * @param {string} prompt - Original user prompt for intro content
 * @returns {string} Complete intro slide HTML
 */
const generateIntroSlideHTML = (theme, prompt) => {
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES["PwC Design 1"];
  const title = prompt.split('\n')[0].substring(0, 50) || "Presentation";
  
  return `<section style="
    width: 1280px;
    height: 720px;
    background: linear-gradient(135deg, ${themeStyle.primaryColor} 0%, ${themeStyle.backgroundColor} 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px;
    font-family: ${themeStyle.fontFamily};
    box-sizing: border-box;
  ">
    <div style="text-align: center;">
      <h1 style="
        color: white;
        font-size: 64px;
        font-weight: bold;
        margin: 0 0 30px 0;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">${title}</h1>
      <p style="
        color: ${themeStyle.secondaryColor};
        font-size: 24px;
        margin: 20px 0;
      ">Introduction</p>
      <div style="
        height: 3px;
        width: 200px;
        background-color: ${themeStyle.secondaryColor};
        margin: 20px auto;
      "></div>
      <p style="
        color: rgba(255,255,255,0.9);
        font-size: 18px;
        max-width: 900px;
        line-height: 1.6;
        margin-top: 40px;
      ">A comprehensive presentation covering key insights and strategic information.</p>
    </div>
  </section>`;
};

/**
 * Generate thank you slide HTML
 * @param {string} theme - Theme name
 * @returns {string} Complete thank you slide HTML
 */
const generateThankYouSlideHTML = (theme) => {
  const themeStyle = THEME_STYLES[theme] || THEME_STYLES["PwC Design 1"];
  
  return `<section style="
    width: 1280px;
    height: 720px;
    background: linear-gradient(135deg, ${themeStyle.primaryColor} 0%, ${themeStyle.backgroundColor} 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px;
    font-family: ${themeStyle.fontFamily};
    box-sizing: border-box;
  ">
    <div style="text-align: center;">
      <h1 style="
        color: white;
        font-size: 64px;
        font-weight: bold;
        margin: 0 0 30px 0;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">Thank You</h1>
      <div style="
        height: 3px;
        width: 200px;
        background-color: ${themeStyle.secondaryColor};
        margin: 30px auto;
      "></div>
      <p style="
        color: rgba(255,255,255,0.9);
        font-size: 24px;
        margin-top: 50px;
      ">Thank you for your attention</p>
      <p style="
        color: ${themeStyle.secondaryColor};
        font-size: 18px;
        margin-top: 20px;
      ">Questions?</p>
      <p style="
        color: rgba(255,255,255,0.7);
        font-size: 14px;
        margin-top: 60px;
      ">Powered by AI Presentation Generator</p>
    </div>
  </section>`;
};

/**
 * Wrap raw HTML section with proper document structure
 * @param {string} htmlContent - Raw HTML section content
 * @param {number} slideNumber - Slide number for reference
 * @param {string} slideName - Name of the slide
 * @returns {string} Complete HTML document
 */
const wrapHTMLSlide = (htmlContent, slideNumber, slideName) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${slideName} - Slide ${slideNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      overflow: hidden;
      background: #f5f5f5;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
};

/**
 * Process complete presentation sections from LLM (includes intro and thank you)
 * Wraps all sections in HTML documents
 * @param {array} htmlSections - Array of all HTML sections from LLM (intro + content + thank you)
 * @param {number} numberOfPages - Expected number of content pages (not including intro/thank you)
 * @returns {array} Array of complete slide objects with wrapped HTML
 */
const processCompletePresentationSections = (htmlSections, numberOfPages) => {
  const slides = [];

  if (!htmlSections || htmlSections.length === 0) {
    console.warn("No HTML sections provided");
    return [];
  }

  // Add all sections as slides (LLM generates intro, content, and thank you)
  // Expected: intro (1) + content (numberOfPages) + thank you (1) = numberOfPages + 2 total
  for (let i = 0; i < htmlSections.length; i++) {
    const htmlSection = htmlSections[i];
    const slideNumber = i + 1;
    let slideName = `Slide ${slideNumber}`;

    if (i === 0) {
      slideName = "Introduction";
    } else if (i === htmlSections.length - 1) {
      slideName = "Thank You";
    } else {
      slideName = `Content ${i}`;
    }

    slides.push({
      slideName: slideName,
      slideNumber: slideNumber,
      content: wrapHTMLSlide(htmlSection, slideNumber, slideName),
    });
  }

  return slides;
};

/**
 * Split HTML sections into individual slides (legacy - for old flow)
 * Adds intro slide at the beginning and thank you slide at the end
 * @param {array} htmlSections - Array of HTML section strings from LLM
 * @param {number} numberOfPages - Expected number of content pages
 * @param {string} theme - Theme name
 * @param {string} prompt - Original user prompt for intro
 * @returns {array} Array of complete slide objects with wrapped HTML
 */
const splitSectionsIntoSlides = (htmlSections, numberOfPages, theme, prompt) => {
  const slides = [];

  // Add intro slide
  const introHTML = generateIntroSlideHTML(theme, prompt);
  slides.push({
    slideName: "Introduction",
    slideNumber: 1,
    content: wrapHTMLSlide(introHTML, 1, "Introduction"),
  });

  // Add content slides from extracted sections
  const contentSlidesToAdd = Math.min(htmlSections.length, numberOfPages);
  for (let i = 0; i < contentSlidesToAdd; i++) {
    const htmlSection = htmlSections[i];
    const slideNumber = slides.length + 1;
    const slideName = `Slide ${i + 1}`;

    slides.push({
      slideName: slideName,
      slideNumber: slideNumber,
      content: wrapHTMLSlide(htmlSection, slideNumber, slideName),
    });
  }

  // Add thank you slide
  const thankYouHTML = generateThankYouSlideHTML(theme);
  const thankYouSlideNumber = slides.length + 1;
  slides.push({
    slideName: "Thank You",
    slideNumber: thankYouSlideNumber,
    content: wrapHTMLSlide(thankYouHTML, thankYouSlideNumber, "Thank You"),
  });

  return slides;
};

module.exports = {
  THEME_STYLES,
  getTemplatePatterns,
  buildDesignInstruction,
  buildCompletePresentationPrompt,
  buildRawHTMLPresentationPrompt,
  extractCompletePresentationSections,
  extractHTMLSections,
  generateIntroSlideHTML,
  generateThankYouSlideHTML,
  wrapHTMLSlide,
  processCompletePresentationSections,
  splitSectionsIntoSlides,
};
