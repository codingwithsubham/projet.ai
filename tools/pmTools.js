const { MultiServerMCPClient } = require("@langchain/mcp-adapters");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

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
        "Format report, cumulative, comparison, KPI, status, or summary data into a GitHub-flavored markdown table with optional intro and summary text. Use this when returning structured PM reports to the chat UI.",
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

const buildPmTools = async (project) => {
  const mcpClient = new MultiServerMCPClient({
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: project.pat_token,
      },
      transport: "stdio",
    },
  });

  // Initialize tools (e.g., GitHub) and shared feedback tool for PM agent
  const githubTool = await mcpClient.getTools();
  const markdownReportTableTool = createMarkdownReportTableTool();

  return [...githubTool, markdownReportTableTool];
};

module.exports = { buildPmTools };
