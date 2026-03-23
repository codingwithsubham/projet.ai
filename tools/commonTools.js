const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { addDocuments } = require("../services/vectorStore.service");
const {
  LOW_SIGNAL_FEEDBACK,
  HAPPY_KEYWORDS,
  FEEDBACK_SCOPE,
} = require("../common/kb-constants");

const normalizeFeedback = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ");

const isLowSignalFeedback = (value = "") => {
  const normalized = normalizeFeedback(value);
  return !normalized || LOW_SIGNAL_FEEDBACK.has(normalized);
};

const isClearlyHappyFeedback = (value = "") => {
  const normalized = normalizeFeedback(value);
  if (!normalized) return false;
  return HAPPY_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const buildHappyFeedbackRecordText = ({
  actualUserQuestion,
  llmFinalResponse,
  userFeedback,
}) => {
  return [
    "User Prompt (Actual Question):",
    actualUserQuestion,
    "",
    "LLM Final Response (Before Performing Any Action):",
    llmFinalResponse,
    "",
    "User Feedback:",
    userFeedback,
  ].join("\n");
};

const createStoreHappyFeedbackTool = (project) => {
  return tool(
    async ({ actualUserQuestion, llmFinalResponse, userFeedback }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        throw new Error(
          "Project id is required to store feedback in vector DB",
        );
      }

      if (
        isLowSignalFeedback(userFeedback) ||
        !isClearlyHappyFeedback(userFeedback)
      ) {
        return JSON.stringify({
          success: false,
          skipped: true,
          message:
            "Feedback skipped: only clearly happy/positive feedback is stored.",
        });
      }

      const text = buildHappyFeedbackRecordText({
        actualUserQuestion,
        llmFinalResponse,
        userFeedback,
      });

      const now = Date.now();
      const recordId = `${projectId}-feedback-${now}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        await addDocuments({
          project,
          documents: [
            {
              pageContent: text,
              metadata: {
                scope: FEEDBACK_SCOPE,
                source: "pm-agent-happy-feedback",
                id: recordId,
                kind: "happy_feedback",
                createdAt: new Date(now).toISOString(),
              },
            },
          ],
        });
      } catch (error) {
        console.log("Error storing happy feedback to vector store:", error);
        return JSON.stringify({
          success: false,
          message: "Error storing happy feedback in knowledge base",
          error: error.message,
        });
      }
      return JSON.stringify({
        success: true,
        message: "Happy feedback stored in knowledge base",
        recordId,
        projectId,
        scope: FEEDBACK_SCOPE,
      });
    },
    {
      name: "store_happy_feedback_to_kb",
      description:
        "Store user's happy feedback into vector knowledge base. Input must include the user's exact actual question, the LLM final response before any action, and user feedback.",
      schema: z.object({
        actualUserQuestion: z
          .string()
          .trim()
          .min(1)
          .describe(
            "User prompt as the exact actual question, not paraphrased.",
          ),
        llmFinalResponse: z
          .string()
          .trim()
          .min(1)
          .describe(
            "LLM final response given before performing any tool action.",
          ),
        userFeedback: z
          .string()
          .trim()
          .min(1)
          .describe("User's happy feedback message."),
      }),
    },
  );
};

const buildMermaidChart = ({
  chartType = "bar",
  title = "",
  data = {},
  config = {},
}) => {
  const normalizedType = String(chartType || "bar").toLowerCase().trim();
  
  // Validate chart type
  const supportedTypes = [
    "bar",
    "pie",
    "line",
    "flowchart",
    "graph",
    "sequence",
    "state",
    "gantt",
  ];
  
  if (!supportedTypes.includes(normalizedType)) {
    throw new Error(
      `Unsupported chart type: ${chartType}. Supported types: ${supportedTypes.join(", ")}`,
    );
  }

  let mermaidCode = "";

  // Bar chart
  if (normalizedType === "bar") {
    const { labels = [], datasets = [] } = data;
    
    if (!labels || labels.length === 0) {
      throw new Error("Bar chart requires labels array in data");
    }
    
    if (!datasets || datasets.length === 0) {
      throw new Error("Bar chart requires at least one dataset");
    }

    // Calculate max value for y-axis
    const allValues = datasets.flatMap(d => (d.values || []).map(v => Number(v) || 0));
    const maxValue = Math.max(...allValues, 0);
    const yAxisMax = Math.ceil(maxValue * 1.2); // Add 20% padding

    mermaidCode = `xychart-beta\n`;
    
    if (title.trim()) {
      const chartTitle = `"${String(title.trim()).replace(/"/g, '\\"')}"`.replace(/\\\"/g, '\\"');
      mermaidCode += `  title ${chartTitle}\n`;
    }

    const xAxisLabels = labels
      .map((l) => `"${String(l).replace(/"/g, '\\"')}"`)
      .join(", ");
    mermaidCode += `  x-axis [${xAxisLabels}]\n`;
    mermaidCode += `  y-axis "Values" 0 --> ${yAxisMax}\n`;

    datasets.forEach(({ values }) => {
      const valueStr = values.map((v) => Number(v) || 0).join(", ");
      mermaidCode += `  bar [${valueStr}]\n`;
    });
  }

  // Pie chart
  else if (normalizedType === "pie") {
    const { labels = [], values = [] } = data;
    
    if (!labels || labels.length === 0) {
      throw new Error("Pie chart requires labels array");
    }
    
    if (!values || values.length === 0) {
      throw new Error("Pie chart requires values array");
    }

    if (labels.length !== values.length) {
      throw new Error("Labels and values arrays must have the same length");
    }

    const chartTitle = title.trim() ? `"${String(title.trim()).replace(/"/g, '\\"')}"` : '"Chart"';
    mermaidCode = `pie title ${chartTitle}\n`;
    
    labels.forEach((label, idx) => {
      const sanitizedLabel = String(label || `Item ${idx + 1}`)
        .replace(/"/g, '\\"')
        .trim();
      const value = Number(values[idx]) || 0;
      mermaidCode += `  "${sanitizedLabel}": ${value}\n`;
    });
  }

  // Line chart
  else if (normalizedType === "line") {
    const { labels = [], datasets = [] } = data;
    
    if (!labels || labels.length === 0) {
      throw new Error("Line chart requires labels array");
    }
    
    if (!datasets || datasets.length === 0) {
      throw new Error("Line chart requires at least one dataset");
    }

    // Calculate max value for y-axis
    const allValues = datasets.flatMap(d => (d.values || []).map(v => Number(v) || 0));
    const maxValue = Math.max(...allValues, 0);
    const yAxisMax = Math.ceil(maxValue * 1.2); // Add 20% padding

    mermaidCode = "xychart-beta\n";
    
    if (title.trim()) {
      const chartTitle = `"${String(title.trim()).replace(/"/g, '\\"')}"`.replace(/\\\"/g, '\\"');
      mermaidCode += `  title ${chartTitle}\n`;
    }

    const labelStr = labels.map((l) => `"${String(l).replace(/"/g, '\\"')}"`).join(", ");
    mermaidCode += `  x-axis [${labelStr}]\n`;
    mermaidCode += `  y-axis "Values" 0 --> ${yAxisMax}\n`;

    datasets.forEach(({ values }) => {
      const valueStr = values.map((v) => Number(v) || 0).join(", ");
      mermaidCode += `  line [${valueStr}]\n`;
    });
  }

  // Flowchart
  else if (normalizedType === "flowchart" || normalizedType === "graph") {
    const { nodes = [], edges = [], direction = "TD" } = data;
    
    if (!nodes || nodes.length === 0) {
      throw new Error("Flowchart requires nodes array");
    }

    const validDirections = ["TD", "LR", "BT", "RL"];
    const dir = validDirections.includes(String(direction).toUpperCase())
      ? String(direction).toUpperCase()
      : "TD";

    mermaidCode = `flowchart ${dir}\n`;

    if (title.trim()) {
      mermaidCode += `%% ${title.trim()}\n`;
    }

    nodes.forEach(({ id, label, shape = "default" }) => {
      const sanitizedId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const sanitizedLabel = String(label || id || "")
        .replace(/"/g, '\\"')
        .trim();

      if (shape === "circle") {
        mermaidCode += `  ${sanitizedId}(("${sanitizedLabel}"))\n`;
      } else if (shape === "square") {
        mermaidCode += `  ${sanitizedId}["${sanitizedLabel}"]\n`;
      } else if (shape === "diamond") {
        mermaidCode += `  ${sanitizedId}{"${sanitizedLabel}"}\n`;
      } else if (shape === "rhombus") {
        mermaidCode += `  ${sanitizedId}[\\"${sanitizedLabel}"/]\n`;
      } else if (shape === "trapezoid") {
        mermaidCode += `  ${sanitizedId}[\\\\"${sanitizedLabel}"//]\n`;
      } else if (shape === "parallelogram") {
        mermaidCode += `  ${sanitizedId}[/"${sanitizedLabel}"\\\\]\n`;
      } else {
        mermaidCode += `  ${sanitizedId}["${sanitizedLabel}"]\n`;
      }
    });

    if (Array.isArray(edges) && edges.length > 0) {
      mermaidCode += "\n";
      edges.forEach(({ from, to, label = "" }) => {
        const sanitizedFrom = String(from || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedTo = String(to || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedLabel = String(label || "")
          .replace(/"/g, '\\"')
          .trim();

        if (sanitizedLabel) {
          mermaidCode += `  ${sanitizedFrom} -->|"${sanitizedLabel}"| ${sanitizedTo}\n`;
        } else {
          mermaidCode += `  ${sanitizedFrom} --> ${sanitizedTo}\n`;
        }
      });
    }
  }

  // State diagram
  else if (normalizedType === "state") {
    const { states = [], transitions = [] } = data;
    
    if (!states || states.length === 0) {
      throw new Error("State diagram requires states array");
    }

    mermaidCode = "stateDiagram-v2\n";

    if (title.trim()) {
      mermaidCode += `%% ${title.trim()}\n`;
    }

    states.forEach(({ id, label }) => {
      const sanitizedId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
      if (label && label !== id) {
        const sanitizedLabel = String(label || "")
          .replace(/"/g, '\\"')
          .trim();
        mermaidCode += `  ${sanitizedId}: "${sanitizedLabel}"\n`;
      }
    });

    if (Array.isArray(transitions) && transitions.length > 0) {
      mermaidCode += "\n";
      transitions.forEach(({ from, to, event }) => {
        const sanitizedFrom = String(from || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedTo = String(to || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const sanitizedEvent = String(event || "")
          .replace(/"/g, '\\"')
          .trim();

        if (sanitizedEvent) {
          mermaidCode += `  ${sanitizedFrom} --> ${sanitizedTo}: ${sanitizedEvent}\n`;
        } else {
          mermaidCode += `  ${sanitizedFrom} --> ${sanitizedTo}\n`;
        }
      });
    }
  }

  // Gantt chart
  else if (normalizedType === "gantt") {
    const { title: ganttTitle, tasks = [] } = data;
    
    if (!tasks || tasks.length === 0) {
      throw new Error("Gantt chart requires tasks array");
    }

    mermaidCode = "gantt\n";
    const ganttChartTitle = title.trim() || ganttTitle?.trim() || "Gantt Chart";
    const escapedGanttTitle = `"${String(ganttChartTitle).replace(/"/g, '\\"')}"`;
    mermaidCode += `title ${escapedGanttTitle}\n`;
    mermaidCode += `dateFormat YYYY-MM-DD\n`;

    tasks.forEach(({ id, title: taskTitle, startDate, endDate, status = "done" }) => {
      const sanitizedId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const sanitizedTitle = String(taskTitle || "")
        .replace(/"/g, '\\"')
        .trim();
      const start = String(startDate || "").trim();
      const end = String(endDate || "").trim();

      if (start && end) {
        mermaidCode += `${sanitizedId}: ${status}, "${sanitizedTitle}", ${start}, ${end}\n`;
      }
    });
  }

  // Sequence diagram
  else if (normalizedType === "sequence") {
    const { participants = [], messages = [] } = data;
    
    if (!participants || participants.length === 0) {
      throw new Error("Sequence diagram requires participants array");
    }

    mermaidCode = "sequenceDiagram\n";

    if (title.trim()) {
      mermaidCode += `%% ${title.trim()}\n`;
    }

    participants.forEach((participant) => {
      const sanitizedName = String(participant || "")
        .replace(/"/g, '\\"')
        .trim();
      mermaidCode += `participant "${sanitizedName}"\n`;
    });

    if (Array.isArray(messages) && messages.length > 0) {
      mermaidCode += "\n";
      messages.forEach(({ from, to, message, type = "->", autonumber = false }) => {
        const sanitizedFrom = String(from || "").replace(/[^a-zA-Z0-9_\s-]/g, "");
        const sanitizedTo = String(to || "").replace(/[^a-zA-Z0-9_\s-]/g, "");
        const sanitizedMsg = String(message || "")
          .replace(/"/g, '\\"')
          .trim();
        const msgType = String(type || "->")
          .replace(/[^-|>]/g, "")
          .trim() || "->";

        mermaidCode += `${sanitizedFrom} ${msgType} ${sanitizedTo}: "${sanitizedMsg}"\n`;
      });
    }
  }

  return mermaidCode;
};

const createMermaidChartTool = () => {
  return tool(
    async ({ chartType, title, data }) => {
      const mermaidCode = buildMermaidChart({
        chartType,
        title,
        data,
      });

      // Wrap in markdown code block for frontend rendering
      return `\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
    },
    {
      name: "generate_mermaid_chart",
      description:
        "Generate a Mermaid diagram (chart, flowchart, state diagram, etc.) for visualizing data. The generated diagram will be rendered in the chat UI. Supports: bar, pie, line charts, flowcharts, state diagrams, gantt, and sequence diagrams.",
      schema: z.object({
        chartType: z
          .enum(["bar", "pie", "line", "flowchart", "graph", "sequence", "state", "gantt"])
          .describe("Type of chart/diagram to generate"),
        title: z
          .string()
          .trim()
          .optional()
          .describe("Optional title for the chart"),
        data: z
          .object({})
          .passthrough()
          .describe(
            "Chart data object. Structure depends on chartType:\n" +
            "- bar/line: {labels: [string], datasets: [{label: string, values: [number]}]}\n" +
            "- pie: {labels: [string], values: [number]}\n" +
            "- flowchart: {nodes: [{id, label, shape?}], edges: [{from, to, label?}], direction?: 'TD'|'LR'|'BT'|'RL'}\n" +
            "- state: {states: [{id, label}], transitions: [{from, to, event?}]}\n" +
            "- sequence: {participants: [string], messages: [{from, to, message, type?: '->'}]}\n" +
            "- gantt: {title?: string, tasks: [{id, title, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', status?: 'done'}]}",
          ),
      }),
    },
  );
};

const escapeMarkdownTableCell = (value = "") => {
  return String(value ?? "")
    .replace(/\r\n|\r|\n/g, "<br />")
    .replace(/\|/g, "\\|")
    .trim();
};

const buildMarkdownTable = ({
  title = "",
  intro = "",
  columns = [],
  rows = [],
  summary = "",
}) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("At least one table column is required.");
  }

  const sanitizedColumns = columns.map((column) => {
    const normalized = escapeMarkdownTableCell(column);
    if (!normalized) {
      throw new Error("Table columns must be non-empty strings.");
    }
    return normalized;
  });

  const normalizedRows = rows.map((row, index) => {
    if (!Array.isArray(row)) {
      throw new Error(`Row ${index + 1} must be an array.`);
    }

    if (row.length !== sanitizedColumns.length) {
      throw new Error(
        `Row ${index + 1} must contain exactly ${sanitizedColumns.length} cells.`,
      );
    }

    return row.map((cell) => escapeMarkdownTableCell(cell));
  });

  const markdownLines = [];

  if (title.trim()) {
    markdownLines.push(`## ${title.trim()}`, "");
  }

  if (intro.trim()) {
    markdownLines.push(intro.trim(), "");
  }

  markdownLines.push(`| ${sanitizedColumns.join(" | ")} |`);
  markdownLines.push(`| ${sanitizedColumns.map(() => "---").join(" | ")} |`);

  if (normalizedRows.length) {
    normalizedRows.forEach((row) => {
      markdownLines.push(`| ${row.join(" | ")} |`);
    });
  } else {
    markdownLines.push(
      `| ${sanitizedColumns.map((_, columnIndex) => (columnIndex === 0 ? "No data" : "-")).join(" | ")} |`,
    );
  }

  if (summary.trim()) {
    markdownLines.push("", summary.trim());
  }

  return markdownLines.join("\n");
};

const createMarkdownReportTableTool = () => {
  return tool(
    async ({ title, intro, columns, rows, summary }) => {
      return buildMarkdownTable({
        title,
        intro,
        columns,
        rows,
        summary,
      });
    },
    {
      name: "build_markdown_report_table",
      description:
        "Format report, cumulative, comparison, KPI, status, or summary data into a GitHub-flavored markdown table with optional intro and summary text. Use this when returning structured data tables to the chat UI.",
      schema: z.object({
        title: z
          .string()
          .trim()
          .optional()
          .describe("Optional markdown heading to place above the report table."),
        intro: z
          .string()
          .trim()
          .optional()
          .describe("Optional short narrative paragraph to place before the table."),
        columns: z
          .array(z.string().trim().min(1))
          .min(1)
          .describe("Ordered list of table column names."),
        rows: z
          .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
          .describe("Table rows. Each row must have the same number of cells as columns."),
        summary: z
          .string()
          .trim()
          .optional()
          .describe("Optional closing note, summary, or next-step paragraph after the table."),
      }),
    },
  );
};

module.exports = {
  createStoreHappyFeedbackTool,
  createMermaidChartTool,
  createMarkdownReportTableTool,
  buildMarkdownTable,
};
