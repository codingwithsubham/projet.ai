import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";

const ensureMermaidInit = (() => {
  let initialized = false;
  return () => {
    if (initialized) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      suppressErrorRendering: true,
    });

    initialized = true;
  };
})();

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

const MermaidChart = ({ chart }) => {
  const [renderedSvg, setRenderedSvg] = React.useState(null);
  const [renderError, setRenderError] = React.useState(null);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const cleanChart = String(chart || "").trim();
      if (!cleanChart) {
        if (!isMounted) return;
        setRenderedSvg(null);
        setRenderError("Empty Mermaid chart definition.");
        return;
      }

      try {
        ensureMermaidInit();
        const renderId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

        // Add timeout for rendering
        const renderPromise = mermaid.render(renderId, cleanChart);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Chart rendering timeout")), 5000),
        );

        const { svg } = await Promise.race([renderPromise, timeoutPromise]);

        if (!isMounted) return;
        setRenderedSvg(svg);
        setRenderError(null);
      } catch (error) {
        if (!isMounted) return;
        setRenderedSvg(null);
        const errorMsg = String(
          error?.message || "Failed to render Mermaid chart.",
        );
        setRenderError(errorMsg);
        console.error("Mermaid rendering error:", error);
      }
    };

    run();

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [chart]);

  if (renderError) {
    return (
      <div className="chat-markdown__mermaid-error">
        <p style={{ fontSize: "12px", color: "#d32f2f", margin: "0 0 8px 0" }}>
          ⚠️ Chart rendering failed: {renderError}
        </p>
        <pre className="chat-markdown__mermaid-fallback">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (!renderedSvg) {
    return (
      <div className="chat-markdown__mermaid-wrap" aria-live="polite">
        <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
          📊 Rendering chart...
        </p>
      </div>
    );
  }

  return (
    <div className="chat-markdown__mermaid-wrap">
      <div
        className="charts"
        dangerouslySetInnerHTML={{ __html: renderedSvg }}
        style={{ overflow: "auto" }}
      />
    </div>
  );
};

const extractLanguage = (className = "") => {
  const match = String(className || "").match(/language-([\w-]+)/i);
  return (match?.[1] || "").toLowerCase();
};

const isMermaidDiagram = (code = "") => {
  if (!code || typeof code !== "string") return false;

  const normalized = String(code || "").trim();
  if (!normalized) return false;

  // Check for mermaid keywords at start or near start (more aggressive patterns)
  const mermaidPatterns = [
    // Pie charts
    /^\s*pie\s/i,
    // Charts (bar, line, xychart) - bar charts use xychart-beta, not bare "bar"
    /^\s*%%{init:/i,
    /^\s*xychart/i,
    // Flowcharts
    /^\s*flowchart\s/i,
    /^\s*graph\s+(TD|LR|BT|RL|t|l|b|r)/i,
    // State diagrams
    /^\s*state[Dd]iagram/i,
    // Gantt
    /^\s*gantt\s*$\n/im,
    /^\s*gantt\s*\n/i,
    // Sequence
    /^\s*sequenceDiagram/i,
    /^\s*sequence[Dd]iagram/i,
    // Timeline
    /^\s*timeline\s/i,
  ];

  return mermaidPatterns.some((pattern) => {
    try {
      return pattern.test(normalized);
    } catch (e) {
      return false;
    }
  });
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
          code: ({ inline, className: codeClassName, children, ...props }) => {
            const code = String(children || "").replace(/\n$/, "");
            const language = extractLanguage(codeClassName);
            const isMermaid = language === "mermaid" || isMermaidDiagram(code);

            if (!inline && isMermaid) {
              return <MermaidChart chart={code} />;
            }

            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
