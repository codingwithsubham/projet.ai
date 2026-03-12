import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const normalizePipeTableMarkdown = (value = "") => {
  let normalized = String(value || "");

  normalized = normalized.replace(
    /(\|\s*[^\n|]+(?:\s*\|\s*[^\n|]+)+\s*\|)\s*(\|(?:\s*:?-{3,}:?\s*\|)+)/g,
    "$1\n$2",
  );

  normalized = normalized.replace(
    /(\|(?:\s*:?-{3,}:?\s*\|)+)\s*(\|\s*\d+\s*\|)/g,
    "$1\n$2",
  );

  normalized = normalized.replace(/\|\|\s*(?=\d+\s*\|)/g, "|\n| ");

  return normalized;
};

const MarkdownMessage = ({ content, className = "chat-markdown" }) => {
  const normalizedContent = useMemo(
    () => normalizePipeTableMarkdown(content || ""),
    [content],
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="chat-markdown__table-wrap">
              <table className="chat-markdown__table">{children}</table>
            </div>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;