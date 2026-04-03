import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import ReactDOM from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { exportMarkdownToPdf, downloadMarkdown } from "../../utils/pdfExporter";

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CodeCopyButton = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="code-copy-btn" onClick={handleCopy} title={copied ? "Copied!" : "Copy code"}>
      {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
    </button>
  );
};

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

// Icon components for expand and download
const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PdfIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const MarkdownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);

/**
 * PDF Export Card - Shown when content is ready for quick PDF download
 */
const PdfExportCard = ({ exportData }) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const handlePdfDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await exportMarkdownToPdf(exportData.content, {
        filename: exportData.filename,
        title: exportData.title,
      });
    } catch (err) {
      console.error("PDF download failed:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleMarkdownDownload = () => {
    try {
      downloadMarkdown(exportData.content, {
        filename: exportData.filename?.replace('.pdf', '.md'),
      });
    } catch (err) {
      console.error("Markdown download failed:", err);
      setError("Failed to download markdown.");
    }
  };

  return (
    <div className="pdf-export-card">
      <div className="pdf-export-card__header">
        <span className="pdf-export-card__icon">📄</span>
        <span className="pdf-export-card__title">{exportData.title || "Document Ready"}</span>
      </div>
      <div className="pdf-export-card__actions">
        <button
          className="pdf-export-card__btn pdf-export-card__btn--primary"
          onClick={handlePdfDownload}
          disabled={downloading}
        >
          {downloading ? (
            <>
              <span className="pdf-export-card__spinner" />
              Generating...
            </>
          ) : (
            <>
              <PdfIcon />
              Download PDF
            </>
          )}
        </button>
        <button
          className="pdf-export-card__btn pdf-export-card__btn--secondary"
          onClick={handleMarkdownDownload}
        >
          <MarkdownIcon />
          Download MD
        </button>
      </div>
      {error && <p className="pdf-export-card__error">{error}</p>}
    </div>
  );
};

/**
 * Parse export marker from content
 * Returns { exportData, cleanContent } or null if no marker found
 */
const parseExportMarker = (content) => {
  if (!content || typeof content !== "string") return null;
  
  const markerMatch = content.match(/__EXPORT_READY__(.+?)__EXPORT_END__/s);
  if (!markerMatch) return null;
  
  try {
    const exportData = JSON.parse(markerMatch[1]);
    // Remove the marker from content for display
    const cleanContent = content.replace(/__EXPORT_READY__.+?__EXPORT_END__\s*/s, "").trim();
    return { exportData, cleanContent };
  } catch (err) {
    console.error("Failed to parse export marker:", err);
    return null;
  }
};

/**
 * Check if content is a substantial report suitable for PDF export
 * (Has headers, tables, and significant length)
 */
const isExportableReport = (content) => {
  if (!content || typeof content !== "string") return false;
  
  const trimmed = content.trim();
  // Must be substantial length
  if (trimmed.length < 500) return false;
  
  // Must have headers
  const hasHeaders = /^#{1,3}\s+.+$/m.test(trimmed);
  // Must have tables
  const hasTables = /\|.+\|.*\n\|[-:\s|]+\|/m.test(trimmed);
  
  return hasHeaders && hasTables;
};

/**
 * Extract title from markdown content for PDF filename
 */
const extractTitleFromContent = (content) => {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].replace(/[#*_`🏁📊📋👥🚨⚠️📉🔮💡]/g, '').trim();
  
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1].replace(/[#*_`📊📋]/g, '').trim();
  
  return 'Report';
};

/**
 * Download Report Button - Shows on substantial report messages
 */
const DownloadReportButton = ({ content }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const title = extractTitleFromContent(content);
      await exportMarkdownToPdf(content, { title });
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="download-report-inline">
      <button
        className="download-report-btn"
        onClick={handleDownload}
        disabled={downloading}
        title="Download this report as PDF"
      >
        {downloading ? (
          <span className="download-report-spinner" />
        ) : (
          <DownloadIcon />
        )}
        <span>{downloading ? "Generating..." : "Download PDF"}</span>
      </button>
    </div>
  );
};

// Modal component for expanded chart view
const ChartExpandModal = ({ isOpen, onClose, svgContent, onDownload }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="chart-modal-overlay" onClick={onClose}>
      <div
        className="chart-modal-content"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chart-modal-header">
          <span className="chart-modal-title">Chart View</span>
          <div className="chart-modal-actions">
            <button
              className="chart-modal-btn chart-download-btn"
              onClick={onDownload}
              title="Download as PNG"
            >
              <DownloadIcon />
              <span>Download PNG</span>
            </button>
            <button
              className="chart-modal-btn chart-close-btn"
              onClick={onClose}
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="chart-modal-body">
          <div
            className="chart-modal-svg"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

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
  const [renderedSvg, setRenderedSvg] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutRef = useRef(null);

  // Download chart as PNG
  const handleDownload = useCallback(() => {
    if (!renderedSvg) return;

    const container = document.createElement("div");
    container.innerHTML = renderedSvg;
    const svg = container.querySelector("svg");

    if (!svg) return;

    // Parse dimensions from viewBox (most reliable for Mermaid SVGs)
    let width = 800;
    let height = 600;
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      // Fallback: try width/height attributes (only if numeric)
      const attrW = parseFloat(svg.getAttribute("width"));
      const attrH = parseFloat(svg.getAttribute("height"));
      if (attrW > 0) width = attrW;
      if (attrH > 0) height = attrH;
    }

    // Set explicit dimensions on the SVG so the image renders at full size
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    // Create canvas with 2x scale for sharper output
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);

      // Trigger download
      const link = document.createElement("a");
      link.download = `chart-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.onerror = () => {
      console.error("Failed to load SVG for download");
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }, [renderedSvg]);

  useEffect(() => {
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
    <>
      <div className="chat-markdown__mermaid-wrap">
        <div className="chart-toolbar">
          <button
            className="chart-toolbar-btn"
            onClick={() => setIsExpanded(true)}
            title="Expand chart"
          >
            <ExpandIcon />
          </button>
        </div>
        <div
          className="charts"
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
          style={{ overflow: "auto" }}
        />
      </div>
      <ChartExpandModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        svgContent={renderedSvg}
        onDownload={handleDownload}
      />
    </>
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

/**
 * During streaming, incomplete pipe-tables trigger costly re-parses.
 * We detect an in-progress table (last line starts with | but doesn't end
 * with a complete row) and render the stable portion with ReactMarkdown
 * while appending the trailing fragment as plain text.
 */
const splitStreamingContent = (text) => {
  if (!text) return { stable: "", tail: "" };
  const lines = text.split("\n");
  const lastLine = lines[lines.length - 1] || "";
  const inPartialTable =
    lastLine.trimStart().startsWith("|") && !lastLine.trimEnd().endsWith("|");
  if (inPartialTable && lines.length > 1) {
    return { stable: lines.slice(0, -1).join("\n"), tail: lastLine };
  }
  return { stable: text, tail: "" };
};

const MarkdownMessage = memo(({ content, className = "chat-markdown", streaming = false }) => {
  // Check for export marker
  const exportParsed = useMemo(() => parseExportMarker(content), [content]);
  
  // Check if this is an exportable report (has headers + tables + substantial length)
  const showDownloadButton = useMemo(
    () => !exportParsed && !streaming && isExportableReport(content),
    [content, exportParsed, streaming]
  );
  
  const normalizedContent = useMemo(
    () => normalizePipeTableMarkdown(exportParsed?.cleanContent || content || ""),
    [content, exportParsed],
  );

  const { stable, tail } = useMemo(
    () =>
      streaming
        ? splitStreamingContent(normalizedContent)
        : { stable: normalizedContent, tail: "" },
    [normalizedContent, streaming],
  );

  return (
    <div className={className}>
      {/* Show PDF export card if export marker detected */}
      {exportParsed?.exportData && (
        <PdfExportCard exportData={exportParsed.exportData} />
      )}
      
      {/* Show download button for substantial reports */}
      {showDownloadButton && (
        <DownloadReportButton content={content} />
      )}
      
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

            if (!inline && code.includes("\n")) {
              return (
                <div className="code-block-wrap">
                  <div className="code-block-header">
                    {language && <span className="code-block-lang">{language}</span>}
                    <CodeCopyButton code={code} />
                  </div>
                  <pre>
                    <code className={codeClassName} {...props}>{children}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {stable}
      </ReactMarkdown>
      {tail && <span className="chat-markdown__streaming-tail">{tail}</span>}
    </div>
  );
});

MarkdownMessage.displayName = "MarkdownMessage";

export default MarkdownMessage;
