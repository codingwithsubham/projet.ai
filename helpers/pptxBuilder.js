/**
 * PPTX Builder - Native PowerPoint generation from structured JSON
 * Uses pptxgenjs to create native editable PPTX files
 */

const pptxgen = require("pptxgenjs");

// ============================================
// PPTX JSON SCHEMA DEFINITIONS
// ============================================

/**
 * Slide JSON Schema:
 * {
 *   slideType: "cover" | "content" | "conclusion",
 *   background: {
 *     type: "solid" | "gradient",
 *     color: "#hex" (for solid),
 *     colors: ["#hex1", "#hex2"] (for gradient),
 *     angle: number (for gradient, default 90)
 *   },
 *   elements: [
 *     { type: "text", text, x, y, w, h, fontSize, bold, italic, color, align, valign, fontFace },
 *     { type: "image", src, x, y, w, h },
 *     { type: "shape", shape, x, y, w, h, fill, line },
 *     { type: "list", items: [], x, y, w, h, fontSize, color, bullet }
 *   ]
 * }
 */

// ============================================
// PwC BRAND CONSTANTS
// ============================================

const PWC_BRAND = {
  orange: "E85825",
  black: "2D3436",
  darkGray: "636E72",
  lightGray: "B2BEC3",
  white: "FFFFFF",
  peachLight: "FFF5F0",
  peachMedium: "FFE4D9",
  peachDark: "FFD4C4",
  fonts: {
    primary: "Segoe UI",
    secondary: "Arial",
  },
  logo: "https://crystalpng.com/wp-content/uploads/2025/05/pwc-logo.png",
};

// ============================================
// SLIDE TEMPLATES
// ============================================

const SLIDE_TEMPLATES = {
  cover: {
    background: {
      type: "gradient",
      colors: [PWC_BRAND.peachLight, PWC_BRAND.peachMedium],
      angle: 135,
    },
    layout: {
      logoPosition: { x: 0.4, y: 0.3, w: 1.5, h: 0.6 },
      titlePosition: { x: 1.0, y: 2.2, w: 8, h: 1.2 },
      subtitlePosition: { x: 1.0, y: 3.4, w: 8, h: 0.6 },
      authorPosition: { x: 1.0, y: 4.8, w: 4, h: 0.8 },
      decorativeShapes: true,
    },
  },
  content: {
    background: {
      type: "gradient",
      colors: [PWC_BRAND.white, PWC_BRAND.peachLight],
      angle: 180,
    },
    layout: {
      headerHeight: 0.9,
      headerBg: PWC_BRAND.darkGray,
      logoPosition: { x: 8.5, y: 0.2, w: 1.2, h: 0.5 },
      titlePosition: { x: 0.5, y: 0.25, w: 7.5, h: 0.5 },
      contentArea: { x: 0.5, y: 1.2, w: 9, h: 4.0 },
    },
  },
  conclusion: {
    background: {
      type: "gradient",
      colors: [PWC_BRAND.peachLight, PWC_BRAND.peachMedium],
      angle: 135,
    },
    layout: {
      logoPosition: { x: 8.5, y: 0.3, w: 1.2, h: 0.5 },
      titlePosition: { x: 0.5, y: 2.0, w: 9, h: 1.0 },
      messagePosition: { x: 1.0, y: 3.2, w: 8, h: 1.0 },
      questionsPosition: { x: 0.5, y: 4.5, w: 9, h: 0.5 },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert hex color to pptxgenjs format (without #)
 */
const formatColor = (color) => {
  if (!color) return PWC_BRAND.black;
  return color.replace("#", "").toUpperCase();
};

/**
 * Get random relevant image URL based on topic
 */
const getTopicImage = (topic) => {
  const seed = topic.replace(/\s/g, "").substring(0, 15);
  return `https://picsum.photos/seed/${seed}/400/300`;
};

// ============================================
// SLIDE BUILDING FUNCTIONS
// ============================================

/**
 * Apply background to slide
 */
const applyBackground = (slide, background) => {
  if (!background) return;

  if (background.type === "solid") {
    slide.background = { color: formatColor(background.color) };
  } else if (background.type === "gradient") {
    // pptxgenjs doesn't support gradients directly, use first color
    // For better gradients, we'd need to use a shape as background
    slide.background = { color: formatColor(background.colors?.[0] || PWC_BRAND.peachLight) };
  }
};

/**
 * Add text element to slide
 */
const addTextElement = (slide, element) => {
  const options = {
    x: element.x || 0.5,
    y: element.y || 0.5,
    w: element.w || 8,
    h: element.h || 0.5,
    fontSize: element.fontSize || 14,
    fontFace: element.fontFace || PWC_BRAND.fonts.primary,
    color: formatColor(element.color),
    bold: element.bold || false,
    italic: element.italic || false,
    align: element.align || "left",
    valign: element.valign || "middle",
  };

  if (element.fill) {
    options.fill = { color: formatColor(element.fill) };
  }

  if (element.shadow) {
    options.shadow = {
      type: "outer",
      color: "000000",
      blur: 3,
      offset: 2,
      angle: 45,
      opacity: 0.3,
    };
  }

  slide.addText(element.text || "", options);
};

/**
 * Add image element to slide
 */
const addImageElement = (slide, element) => {
  const options = {
    x: element.x || 0,
    y: element.y || 0,
    w: element.w || 2,
    h: element.h || 1,
  };

  if (element.rounding) {
    options.rounding = true;
  }

  // Handle both URL and base64
  if (element.src?.startsWith("data:")) {
    options.data = element.src;
  } else {
    options.path = element.src;
  }

  try {
    slide.addImage(options);
  } catch (err) {
    console.warn(`Failed to add image: ${err.message}`);
  }
};

/**
 * Add shape element to slide
 */
const addShapeElement = (slide, pptx, element) => {
  const shapeMap = {
    rect: pptx.ShapeType.rect,
    rectangle: pptx.ShapeType.rect,
    ellipse: pptx.ShapeType.ellipse,
    oval: pptx.ShapeType.ellipse,
    parallelogram: pptx.ShapeType.parallelogram,
    line: pptx.ShapeType.line,
    triangle: pptx.ShapeType.triangle,
    roundRect: pptx.ShapeType.roundRect,
  };

  const shapeType = shapeMap[element.shape] || pptx.ShapeType.rect;

  const options = {
    x: element.x || 0,
    y: element.y || 0,
    w: element.w || 1,
    h: element.h || 1,
  };

  if (element.fill) {
    options.fill = { color: formatColor(element.fill) };
  }

  if (element.line) {
    options.line = {
      color: formatColor(element.line.color),
      width: element.line.width || 1,
    };
  }

  if (element.rotate) {
    options.rotate = element.rotate;
  }

  slide.addShape(shapeType, options);
};

/**
 * Add bullet list to slide
 */
const addListElement = (slide, element) => {
  if (!element.items || element.items.length === 0) return;

  const textItems = element.items.map((item) => ({
    text: item,
    options: {
      bullet: element.bullet !== false,
      indentLevel: 0,
    },
  }));

  slide.addText(textItems, {
    x: element.x || 0.5,
    y: element.y || 1.5,
    w: element.w || 8,
    h: element.h || 3,
    fontSize: element.fontSize || 14,
    fontFace: PWC_BRAND.fonts.primary,
    color: formatColor(element.color || "#" + PWC_BRAND.darkGray),
    valign: "top",
    paraSpaceAfter: 10,
  });
};

// ============================================
// MAIN BUILD FUNCTION
// ============================================

/**
 * Build PPTX from presentation and slides JSON
 * @param {object} presentation - Presentation metadata
 * @param {array} slides - Array of slide JSON objects with pptxContent
 * @returns {Promise<Buffer>} PPTX file buffer
 */
const buildPPTXFromJson = async (presentation, slides) => {
  const pptx = new pptxgen();

  // Set presentation metadata
  pptx.title = presentation.name || "Untitled Presentation";
  pptx.author = "Projet AI";
  pptx.subject = presentation.description || "";
  pptx.company = "PwC";

  // Set slide size (16:9 widescreen)
  pptx.defineLayout({ name: "CUSTOM", width: 10, height: 5.625 });
  pptx.layout = "CUSTOM";

  // Process each slide
  for (const slideData of slides) {
    const slideJson = slideData.pptxContent || slideData;
    const slide = pptx.addSlide();

    // Apply background
    applyBackground(slide, slideJson.background);

    // Process elements
    if (slideJson.elements && Array.isArray(slideJson.elements)) {
      for (const element of slideJson.elements) {
        switch (element.type) {
          case "text":
            addTextElement(slide, element);
            break;
          case "image":
            addImageElement(slide, element);
            break;
          case "shape":
            addShapeElement(slide, pptx, element);
            break;
          case "list":
            addListElement(slide, element);
            break;
          default:
            console.warn(`Unknown element type: ${element.type}`);
        }
      }
    }
  }

  // Generate buffer
  return await pptx.write({ outputType: "nodebuffer" });
};

// ============================================
// TEMPLATE-BASED SLIDE GENERATORS
// ============================================

/**
 * Generate cover slide JSON
 */
const generateCoverSlideJson = ({ title, subtitle, author, date }) => {
  const template = SLIDE_TEMPLATES.cover;
  
  return {
    slideType: "cover",
    background: template.background,
    elements: [
      // PwC Logo
      {
        type: "image",
        src: PWC_BRAND.logo,
        ...template.layout.logoPosition,
      },
      // Title
      {
        type: "text",
        text: title,
        ...template.layout.titlePosition,
        fontSize: 44,
        bold: true,
        color: "#" + PWC_BRAND.black,
      },
      // Subtitle
      {
        type: "text",
        text: subtitle || "",
        ...template.layout.subtitlePosition,
        fontSize: 20,
        color: "#" + PWC_BRAND.darkGray,
      },
      // Decorative parallelogram 1
      {
        type: "shape",
        shape: "parallelogram",
        x: 4.0,
        y: 4.2,
        w: 3.5,
        h: 0.35,
        fill: "#" + PWC_BRAND.orange,
      },
      // Decorative parallelogram 2
      {
        type: "shape",
        shape: "parallelogram",
        x: 5.5,
        y: 4.6,
        w: 2.5,
        h: 0.35,
        fill: "#" + PWC_BRAND.orange,
      },
      // Author
      {
        type: "text",
        text: `Presented by ${author || "Team"}`,
        x: 1.0,
        y: 4.8,
        w: 4,
        h: 0.3,
        fontSize: 12,
        color: "#" + PWC_BRAND.darkGray,
      },
      // Date
      {
        type: "text",
        text: date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        x: 1.0,
        y: 5.1,
        w: 4,
        h: 0.3,
        fontSize: 11,
        color: "#" + PWC_BRAND.lightGray,
      },
    ],
  };
};

/**
 * Generate content slide JSON
 */
const generateContentSlideJson = ({ title, keyPoints, imageUrl, slideNumber }) => {
  const template = SLIDE_TEMPLATES.content;
  
  const elements = [
    // Header background
    {
      type: "shape",
      shape: "rect",
      x: 0,
      y: 0,
      w: 10,
      h: template.layout.headerHeight,
      fill: "#" + template.layout.headerBg,
    },
    // Title in header
    {
      type: "text",
      text: title,
      ...template.layout.titlePosition,
      fontSize: 22,
      bold: true,
      color: "#" + PWC_BRAND.white,
    },
    // PwC Logo in header
    {
      type: "image",
      src: PWC_BRAND.logo,
      ...template.layout.logoPosition,
    },
  ];

  // Add content - two column layout
  if (keyPoints && keyPoints.length > 0) {
    // Left column - bullet points
    elements.push({
      type: "list",
      items: keyPoints,
      x: 0.5,
      y: 1.3,
      w: 5.5,
      h: 3.8,
      fontSize: 14,
      color: "#" + PWC_BRAND.black,
      bullet: true,
    });
  }

  // Right column - image
  if (imageUrl) {
    elements.push({
      type: "image",
      src: imageUrl,
      x: 6.2,
      y: 1.5,
      w: 3.3,
      h: 2.5,
    });
  }

  // Slide number
  elements.push({
    type: "text",
    text: `${slideNumber || ""}`,
    x: 9.3,
    y: 5.2,
    w: 0.5,
    h: 0.3,
    fontSize: 10,
    color: "#" + PWC_BRAND.lightGray,
    align: "right",
  });

  return {
    slideType: "content",
    background: template.background,
    elements,
  };
};

/**
 * Generate conclusion slide JSON
 */
const generateConclusionSlideJson = ({ message, presentationName }) => {
  const template = SLIDE_TEMPLATES.conclusion;
  
  return {
    slideType: "conclusion",
    background: template.background,
    elements: [
      // PwC Logo
      {
        type: "image",
        src: PWC_BRAND.logo,
        ...template.layout.logoPosition,
      },
      // Thank You text
      {
        type: "text",
        text: "Thank You",
        ...template.layout.titlePosition,
        fontSize: 48,
        bold: true,
        color: "#" + PWC_BRAND.black,
        align: "center",
      },
      // Closing message
      {
        type: "text",
        text: message || `Thank you for viewing "${presentationName}"`,
        ...template.layout.messagePosition,
        fontSize: 16,
        color: "#" + PWC_BRAND.darkGray,
        align: "center",
      },
      // Questions prompt
      {
        type: "text",
        text: "Questions?",
        ...template.layout.questionsPosition,
        fontSize: 18,
        bold: true,
        color: "#" + PWC_BRAND.orange,
        align: "center",
      },
      // Decorative element
      {
        type: "shape",
        shape: "rect",
        x: 4.0,
        y: 4.0,
        w: 2.0,
        h: 0.05,
        fill: "#" + PWC_BRAND.orange,
      },
    ],
  };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  buildPPTXFromJson,
  generateCoverSlideJson,
  generateContentSlideJson,
  generateConclusionSlideJson,
  PWC_BRAND,
  SLIDE_TEMPLATES,
  formatColor,
  getTopicImage,
};
