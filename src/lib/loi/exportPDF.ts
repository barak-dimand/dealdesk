import type { LOISection } from "@/types";

/**
 * Client-side PDF export via the browser print dialog — renders the LOI
 * into a hidden iframe and triggers print (user picks "Save as PDF").
 */
export async function exportLOIAsPDF(
  dealName: string,
  sections: LOISection[]
): Promise<void> {
  const html = buildPrintHTML(dealName, sections);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for fonts to load then print
  await new Promise((resolve) => setTimeout(resolve, 500));
  iframe.contentWindow?.print();

  // Clean up after the print dialog closes
  setTimeout(() => document.body.removeChild(iframe), 2000);
}

function buildPrintHTML(dealName: string, sections: LOISection[]): string {
  const sortedSections = [...sections].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const sectionsHTML = sortedSections
    .map(
      (s) => `
    <div class="section">
      <p class="section-label">${s.label.toUpperCase()}</p>
      <div class="section-content">${s.content.replace(/\n/g, "<br>")}</div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LOI — ${dealName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Schibsted Grotesk', Georgia, serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #23211d;
      padding: 1in;
      max-width: 8.5in;
    }

    h1 {
      font-size: 16pt;
      font-weight: 600;
      margin-bottom: 6pt;
    }

    .subtitle {
      font-size: 10pt;
      color: #9b978f;
      margin-bottom: 32pt;
      border-bottom: 1px solid #e6e3dc;
      padding-bottom: 12pt;
    }

    .section {
      margin-bottom: 20pt;
      page-break-inside: avoid;
    }

    .section-label {
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: .08em;
      color: #9b978f;
      text-transform: uppercase;
      margin-bottom: 4pt;
    }

    .section-content {
      font-size: 11pt;
      line-height: 1.7;
    }

    @media print {
      body { padding: 0.75in; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Letter of Intent</h1>
  <p class="subtitle">${dealName} &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  ${sectionsHTML}
</body>
</html>`;
}
