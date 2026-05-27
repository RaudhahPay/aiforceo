/**
 * Client-side export helpers — zero external dependencies.
 * All functions are browser-only; do not import in server components.
 */

// ─── Markdown → basic HTML ───────────────────────────────────────────────────
function mdToHtml(md: string): string {
  return (
    md
      // Fenced code blocks
      .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // H1–H3
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // Bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Blockquote
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      // Unordered list items
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      // Ordered list items
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // Horizontal rule
      .replace(/^---+$/gm, "<hr>")
      // Markdown tables → HTML table
      .replace(
        /(\|.+\|\n)((?:\|[-:| ]+\|\n))((?:\|.+\|\n?)+)/g,
        (_, header, _sep, body) => {
          const ths = header
            .split("|")
            .slice(1, -1)
            .map((c: string) => `<th>${c.trim()}</th>`)
            .join("");
          const rows = body
            .trim()
            .split("\n")
            .map(
              (row: string) =>
                "<tr>" +
                row
                  .split("|")
                  .slice(1, -1)
                  .map((c: string) => `<td>${c.trim()}</td>`)
                  .join("") +
                "</tr>",
            )
            .join("");
          return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
        },
      )
      // Wrap consecutive <li> in <ul>
      .replace(
        /(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g,
        (m) => `<ul>${m}</ul>`,
      )
      // Double newline → paragraph break
      .replace(/\n\n/g, "</p><p>")
      // Single newline → <br>
      .replace(/\n/g, "<br>")
      // Wrap in paragraph if not already a block element
      .replace(/^(?!<[huptb]|<ul|<ol|<pre|<bl|<hr)(.+)/gm, "<p>$1</p>")
  );
}

function printStyles(): string {
  return `
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 40px auto; color: #1a1a1a; line-height: 1.75; font-size: 14px; }
    h1 { font-size: 22px; font-weight: 700; margin: 1.5em 0 0.5em; }
    h2 { font-size: 18px; font-weight: 700; margin: 1.2em 0 0.4em; }
    h3 { font-size: 15px; font-weight: 700; margin: 1em 0 0.3em; }
    p  { margin: 0 0 0.8em; }
    ul, ol { padding-left: 1.5em; margin: 0 0 0.8em; }
    li { margin-bottom: 0.25em; }
    code { background: #f5f5f5; padding: 0.1em 0.35em; border-radius: 3px; font-size: 12px; font-family: monospace; }
    pre  { background: #f5f5f5; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin: 0.8em 0; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #555; margin: 0.8em 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 700; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.2em 0; }
    .header { font-size: 11px; color: #888; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #D4A017; }
    @media print { body { margin: 20px; } }
  `;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Copy plain text to clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

/** Open a print dialog pre-populated with the formatted content (save as PDF). */
export function exportPDF(
  content: string,
  opts: { agentName: string; agentTitle: string; workspaceName: string },
): void {
  const win = window.open("", "_blank", "width=820,height=700");
  if (!win) return;
  const date = new Date().toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  win.document.write(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>${opts.agentName} — ${opts.workspaceName}</title>
    <style>${printStyles()}</style>
  </head><body>
    <div class="header">
      <strong>${opts.agentName}</strong> · ${opts.agentTitle} &nbsp;|&nbsp;
      ${opts.workspaceName} &nbsp;|&nbsp; ${date} &nbsp;|&nbsp; Boardroom AI
    </div>
    ${mdToHtml(content)}
  </body></html>`);
  win.document.close();
  win.focus();
  // Small delay lets the browser finish rendering before the print dialog opens
  setTimeout(() => {
    win.print();
  }, 300);
}

/** Download content as a .doc file that opens in Word / Pages / LibreOffice. */
export function exportWord(
  content: string,
  opts: { agentName: string; agentTitle: string; workspaceName: string },
): void {
  const date = new Date().toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <title>${opts.agentName} — ${opts.workspaceName}</title>
    <style>${printStyles()}</style>
  </head>
  <body>
    <div class="header">
      <strong>${opts.agentName}</strong> · ${opts.agentTitle} &nbsp;|&nbsp;
      ${opts.workspaceName} &nbsp;|&nbsp; ${date} &nbsp;|&nbsp; Boardroom AI
    </div>
    ${mdToHtml(content)}
  </body></html>`;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  downloadBlob(blob, `${opts.agentName}-${opts.workspaceName}-${date}.doc`);
}

/**
 * Download content as a .csv file.
 * If markdown tables are found, they become structured rows.
 * Otherwise, each line becomes a row in a single "Content" column.
 */
export function exportCSV(
  content: string,
  opts: { agentName: string; workspaceName: string },
): void {
  const date = new Date().toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let csv: string;

  // Try to extract the first markdown table
  const tableMatch = content.match(
    /(\|.+\|\n)((?:\|[-:| ]+\|\n))((?:\|.+\|\n?)+)/,
  );
  if (tableMatch) {
    const [, header, , body] = tableMatch;
    const headers = header!
      .split("|")
      .slice(1, -1)
      .map((c) => csvCell(c.trim()));
    const rows = body!
      .trim()
      .split("\n")
      .map((row) =>
        row
          .split("|")
          .slice(1, -1)
          .map((c) => csvCell(c.trim()))
          .join(","),
      );
    csv = [headers.join(","), ...rows].join("\n");
  } else {
    // Fallback: one column per line, strip markdown symbols
    const lines = content
      .split("\n")
      .map((l) =>
        l
          .replace(/^#+\s*/, "")
          .replace(/\*\*/g, "")
          .trim(),
      )
      .filter(Boolean);
    csv =
      `"${opts.agentName} — ${opts.workspaceName} — ${date}"\n` +
      lines.map((l) => csvCell(l)).join("\n");
  }

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); // BOM for Excel
  downloadBlob(blob, `${opts.agentName}-${opts.workspaceName}-${date}.csv`);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
function csvCell(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
