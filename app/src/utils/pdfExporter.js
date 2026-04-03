/**
 * PDF Exporter Utility
 * 
 * Converts Markdown content to PDF using html2pdf.js
 * Designed for exporting chat reports and summaries
 */

import html2pdf from 'html2pdf.js';
import { marked } from 'marked';

// Configure marked for GFM (tables, strikethrough, etc.)
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * PDF styling for professional document output
 */
const getPdfStyles = () => `
  <style>
    * {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      line-height: 1.6;
    }
    body {
      color: #1a1a2e;
      padding: 0;
      margin: 0;
    }
    h1 {
      color: #1a1a2e;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 2px solid #6366f1;
    }
    h2 {
      color: #1a1a2e;
      font-size: 18px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    h3 {
      color: #374151;
      font-size: 15px;
      font-weight: 600;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    p {
      margin: 8px 0;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      font-size: 10px;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    ul, ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    li {
      margin: 4px 0;
      font-size: 12px;
    }
    code {
      background-color: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
    }
    pre {
      background-color: #1e1e2e;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 3px solid #6366f1;
      margin: 12px 0;
      padding-left: 12px;
      color: #6b7280;
      font-style: italic;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16px 0;
    }
    .pdf-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .pdf-header h1 {
      border-bottom: none;
      margin-bottom: 4px;
    }
    .pdf-header .pdf-meta {
      font-size: 10px;
      color: #6b7280;
    }
    .pdf-footer {
      position: fixed;
      bottom: 10px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
    }
    /* Emoji support */
    .emoji {
      font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
    }
  </style>
`;

/**
 * Extract title from markdown content
 * Looks for first H1, H2, or uses default
 */
const extractTitle = (markdown) => {
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].replace(/[#*_`]/g, '').trim();
  
  const h2Match = markdown.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1].replace(/[#*_`]/g, '').trim();
  
  return 'Report';
};

/**
 * Generate filename from title
 */
const generateFilename = (title, extension = 'pdf') => {
  const sanitized = title
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  return `${sanitized}_${timestamp}.${extension}`;
};

/**
 * Convert markdown to styled HTML for PDF
 */
const markdownToHtml = (markdown, options = {}) => {
  const { includeHeader = true, title = null } = options;
  
  const docTitle = title || extractTitle(markdown);
  const htmlContent = marked.parse(markdown);
  const now = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let html = getPdfStyles();
  
  if (includeHeader) {
    html += `
      <div class="pdf-header">
        <h1>${docTitle}</h1>
        <div class="pdf-meta">Generated on ${now} | Pro-jet.ai</div>
      </div>
    `;
  }
  
  html += `<div class="pdf-content">${htmlContent}</div>`;
  
  return html;
};

/**
 * Export markdown content to PDF
 * 
 * @param {string} markdown - Markdown content to export
 * @param {Object} options - Export options
 * @param {string} options.filename - Custom filename (optional)
 * @param {string} options.title - Document title (optional, extracted from content if not provided)
 * @param {boolean} options.includeHeader - Include header with title and date (default: true)
 * @returns {Promise<void>}
 */
export const exportMarkdownToPdf = async (markdown, options = {}) => {
  const { filename, title, includeHeader = true } = options;
  
  const docTitle = title || extractTitle(markdown);
  const pdfFilename = filename || generateFilename(docTitle);
  const html = markdownToHtml(markdown, { includeHeader, title: docTitle });

  // Create container element
  const container = document.createElement('div');
  container.innerHTML = html;

  // PDF options
  const pdfOptions = {
    margin: [15, 15, 20, 15], // top, left, bottom, right in mm
    filename: pdfFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(pdfOptions).from(container).save();
    return { success: true, filename: pdfFilename };
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

/**
 * Download markdown as .md file
 * 
 * @param {string} markdown - Markdown content
 * @param {Object} options - Options
 * @param {string} options.filename - Custom filename
 */
export const downloadMarkdown = (markdown, options = {}) => {
  const { filename } = options;
  const docTitle = extractTitle(markdown);
  const mdFilename = filename || generateFilename(docTitle, 'md');
  
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = mdFilename;
  link.click();
  
  URL.revokeObjectURL(url);
  return { success: true, filename: mdFilename };
};

/**
 * Check if content is suitable for PDF export
 * (Has meaningful structure like headers, tables, or sufficient length)
 */
export const isExportableContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  const trimmed = content.trim();
  if (trimmed.length < 100) return false;
  
  // Check for report-like structure
  const hasHeaders = /^#{1,3}\s+.+$/m.test(trimmed);
  const hasTables = /\|.+\|/.test(trimmed);
  const hasLists = /^[\s]*[-*]\s+.+$/m.test(trimmed);
  const hasMultipleParagraphs = (trimmed.match(/\n\n/g) || []).length >= 2;
  
  return hasHeaders || hasTables || (hasLists && hasMultipleParagraphs);
};

export default {
  exportMarkdownToPdf,
  downloadMarkdown,
  isExportableContent,
  extractTitle,
};
