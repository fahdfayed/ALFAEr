import PDFDocument from "pdfkit";

export type Doc = InstanceType<typeof PDFDocument>;

export const PAGE_MARGIN = 36;
export const INK = "#0f172a";
export const MUTED = "#64748b";
export const RULE = "#cbd5e1";
export const HEAD_BG = "#f1f5f9";

/** Renders a pdfkit document to a Buffer. */
export function render(build: (doc: Doc) => void, options: PDFKit.PDFDocumentOptions = {}) {
  return new Promise<Buffer>((resolve, reject) => {
    // pdfkit's default fonts are .afm-based Helvetica etc., which it resolves
    // from its own bundled data — no font files need shipping.
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      ...options,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function contentWidth(doc: Doc) {
  return doc.page.width - PAGE_MARGIN * 2;
}

export function header(
  doc: Doc,
  opts: { title: string; siteName: string; subtitle?: string; meta?: string[] },
) {
  const w = contentWidth(doc);
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(opts.title, PAGE_MARGIN, PAGE_MARGIN);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(opts.siteName + (opts.subtitle ? ` — ${opts.subtitle}` : ""), {
      width: w,
    });

  if (opts.meta?.length) {
    doc.fontSize(8).text(opts.meta.join("   ·   "), { width: w });
  }

  doc.moveDown(0.4);
  const y = doc.y;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_MARGIN + w, y)
    .lineWidth(1)
    .strokeColor(INK)
    .stroke();
  doc.moveDown(0.8);
  doc.fillColor(INK);
}

export function sectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 40);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(MUTED)
    .text(title.toUpperCase(), PAGE_MARGIN, doc.y, { characterSpacing: 0.6 });
  doc.moveDown(0.25);
  doc.fillColor(INK);
}

/** Two-column label/value grid — the shape most of a pile log takes. */
/**
 * Shortens a string until it fits `width` at the current font, appending an
 * ellipsis. Used where a wrapped value would collide with the row beneath it.
 */
export function fitText(doc: Doc, value: string, width: number): string {
  if (doc.widthOfString(value) <= width) return value;
  let out = value;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > width) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export function keyValueGrid(
  doc: Doc,
  entries: [string, string][],
  columns = 2,
) {
  const w = contentWidth(doc);
  const colW = w / columns;
  const rowH = 15;
  const rows = Math.ceil(entries.length / columns);
  ensureSpace(doc, rows * rowH + 8);

  const top = doc.y;
  entries.forEach(([label, value], i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = PAGE_MARGIN + col * colW;
    const y = top + row * rowH;

    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(fitText(doc, label, colW * 0.46), x, y + 1, {
      width: colW * 0.46,
      lineBreak: false,
    });

    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
    doc.text(fitText(doc, value, colW * 0.5), x + colW * 0.48, y, {
      width: colW * 0.5,
      lineBreak: false,
    });
  });

  doc.y = top + rows * rowH + 6;
  doc.x = PAGE_MARGIN;
}

export interface Column {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export function table(
  doc: Doc,
  columns: Column[],
  rows: string[][],
  opts: { footer?: string[] } = {},
) {
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const scale = contentWidth(doc) / totalWidth;
  const widths = columns.map((c) => c.width * scale);
  const rowH = 16;

  const drawHead = () => {
    ensureSpace(doc, rowH * 2);
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, contentWidth(doc), rowH).fill(HEAD_BG);
    let x = PAGE_MARGIN;
    columns.forEach((c, i) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(c.header.toUpperCase(), x + 4, y + 5, {
          width: widths[i] - 8,
          align: c.align ?? "left",
          lineBreak: false,
        });
      x += widths[i];
    });
    doc.y = y + rowH;
  };

  drawHead();

  for (const row of rows) {
    if (doc.y + rowH > doc.page.height - PAGE_MARGIN - 20) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    let x = PAGE_MARGIN;
    row.forEach((cell, i) => {
      doc.font("Helvetica").fontSize(8.5).fillColor(INK);
      doc.text(fitText(doc, cell, widths[i] - 8), x + 4, y + 4, {
        width: widths[i] - 8,
        align: columns[i].align ?? "left",
        lineBreak: false,
      });
      x += widths[i];
    });
    doc
      .moveTo(PAGE_MARGIN, y + rowH)
      .lineTo(PAGE_MARGIN + contentWidth(doc), y + rowH)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + rowH;
  }

  if (opts.footer) {
    ensureSpace(doc, rowH);
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, contentWidth(doc), rowH).fill(HEAD_BG);
    let x = PAGE_MARGIN;
    opts.footer.forEach((cell, i) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(INK)
        .text(cell, x + 4, y + 4, {
          width: widths[i] - 8,
          align: columns[i].align ?? "left",
          lineBreak: false,
        });
      x += widths[i];
    });
    doc.y = y + rowH;
  }

  doc.x = PAGE_MARGIN;
  doc.moveDown(0.8);
}

export function paragraph(doc: Doc, label: string, body: string) {
  ensureSpace(doc, 34);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase());
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(INK)
    .text(body || "—", { width: contentWidth(doc) });
  doc.moveDown(0.5);
}

export function signatureBlock(doc: Doc, roles: string[]) {
  ensureSpace(doc, 70);
  const w = contentWidth(doc);
  const colW = w / roles.length;
  const top = doc.y + 10;

  roles.forEach((role, i) => {
    const x = PAGE_MARGIN + i * colW;
    doc
      .moveTo(x, top + 30)
      .lineTo(x + colW - 16, top + 30)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(role, x, top + 34, { width: colW - 16 });
  });

  doc.y = top + 50;
  doc.x = PAGE_MARGIN;
}

export function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > doc.page.height - PAGE_MARGIN - 18) doc.addPage();
}

/** Page x of y, stamped once the whole document is laid out. */
export function stampPageNumbers(doc: Doc, footerNote: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // pdfkit starts a new page when text is written past the bottom margin, so
    // the margin is lifted for the footer and restored immediately after.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(
        `${footerNote}    ·    Page ${i - range.start + 1} of ${range.count}`,
        PAGE_MARGIN,
        doc.page.height - PAGE_MARGIN + 4,
        { width: contentWidth(doc), align: "center", lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
  doc.flushPages();
}
