import PDFDocument from "pdfkit";

export type Doc = InstanceType<typeof PDFDocument>;

export const INK = "#0b0b0b";
export const MUTED = "#52514e";
export const RULE = "#c3c2b7";
export const HAIRLINE = "#e1e0d9";

export interface DocMeta {
  name: string;
  clientName?: string | null;
  contractRef?: string | null;
  location?: string | null;
}

export function createDoc(opts: { landscape?: boolean } = {}): Doc {
  return new PDFDocument({
    size: "A4",
    layout: opts.landscape ? "landscape" : "portrait",
    margins: { top: 40, bottom: 46, left: 40, right: 40 },
    bufferPages: true,
    info: { Producer: "ALFAEr", Creator: "ALFAEr" },
  });
}

export function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function contentWidth(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/** Title block at the top of page one. */
export function drawHeader(
  doc: Doc,
  meta: DocMeta,
  title: string,
  subtitle: string,
): void {
  const left = doc.page.margins.left;
  const w = contentWidth(doc);

  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(meta.name, left, 40);

  const details = [meta.clientName, meta.contractRef, meta.location]
    .filter(Boolean)
    .join("  ·  ");
  if (details) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(details, left, 60);
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(INK)
    .text(title.toUpperCase(), left, 40, { width: w, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(subtitle, left, 58, { width: w, align: "right" });

  doc
    .moveTo(left, 80)
    .lineTo(left + w, 80)
    .lineWidth(1)
    .strokeColor(RULE)
    .stroke();

  doc.y = 92;
  doc.fillColor(INK);
}

export function sectionTitle(doc: Doc, label: string): void {
  const left = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
  doc.text(label.toUpperCase(), left, doc.y, { characterSpacing: 0.6 });
  doc.moveDown(0.25);
  const y = doc.y;
  doc
    .moveTo(left, y)
    .lineTo(left + contentWidth(doc), y)
    .lineWidth(0.75)
    .strokeColor(HAIRLINE)
    .stroke();
  doc.y = y + 6;
  doc.fillColor(INK);
}

export type Pair = [string, string];

/**
 * Label/value pairs laid out in columns. This is the shape of a paper pile
 * sheet, which is what makes the output recognisable to a site engineer.
 */
export function drawPairs(doc: Doc, pairs: Pair[], columns = 3): void {
  const left = doc.page.margins.left;
  const w = contentWidth(doc);
  const colW = w / columns;
  const rowH = 22;
  const rows = Math.ceil(pairs.length / columns);
  const startY = doc.y;

  pairs.forEach((pair, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = left + col * colW;
    const y = startY + row * rowH;

    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(pair[0].toUpperCase(), x, y, { width: colW - 10, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
    doc.text(pair[1], x, y + 9, { width: colW - 10, lineBreak: false });
  });

  doc.y = startY + rows * rowH + 4;
}

export function paragraph(doc: Doc, label: string, body: string): void {
  sectionTitle(doc, label);
  doc.font("Helvetica").fontSize(9.5).fillColor(INK);
  doc.text(body, doc.page.margins.left, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.8);
}

export interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
}

export function drawTable(
  doc: Doc,
  columns: Column[],
  rows: string[][],
  opts: { totalRow?: string[] } = {},
): void {
  const left = doc.page.margins.left;
  const rowH = 18;
  const headerH = 18;

  const drawHeadRow = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
    let x = left;
    for (const col of columns) {
      doc.text(col.header.toUpperCase(), x + 3, y + 5, {
        width: col.width - 6,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += col.width;
    }
    const lineY = y + headerH - 2;
    doc
      .moveTo(left, lineY)
      .lineTo(x, lineY)
      .lineWidth(1)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + headerH;
  };

  drawHeadRow();

  doc.font("Helvetica").fontSize(8.5).fillColor(INK);
  for (const row of rows) {
    // Break the page before a row rather than through it.
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeadRow();
      doc.font("Helvetica").fontSize(8.5).fillColor(INK);
    }

    const y = doc.y;
    let x = left;
    row.forEach((cell, i) => {
      const col = columns[i];
      doc.text(cell, x + 3, y + 4, {
        width: col.width - 6,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += col.width;
    });
    doc
      .moveTo(left, y + rowH - 1)
      .lineTo(x, y + rowH - 1)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();
    doc.y = y + rowH;
  }

  if (opts.totalRow) {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK);
    let x = left;
    opts.totalRow.forEach((cell, i) => {
      const col = columns[i];
      doc.text(cell, x + 3, y + 4, {
        width: col.width - 6,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += col.width;
    });
    doc
      .moveTo(left, y + rowH - 1)
      .lineTo(x, y + rowH - 1)
      .lineWidth(1)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + rowH;
  }

  doc.moveDown(0.6);
}

export function signatureBlock(doc: Doc, roles: string[]): void {
  const left = doc.page.margins.left;
  const w = contentWidth(doc);
  const colW = w / roles.length;
  const y = Math.max(doc.y + 14, doc.page.height - doc.page.margins.bottom - 56);

  roles.forEach((role, i) => {
    const x = left + i * colW;
    doc
      .moveTo(x, y + 24)
      .lineTo(x + colW - 18, y + 24)
      .lineWidth(0.75)
      .strokeColor(RULE)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(role.toUpperCase(), x, y + 28, { width: colW - 18, lineBreak: false });
    doc.text("Name / date", x, y + 38, { width: colW - 18, lineBreak: false });
  });

  doc.y = y + 52;
}

/** Footer on every page. Called once, after all content is laid out. */
export function stampFooters(doc: Doc, note: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const left = doc.page.margins.left;
    const w = contentWidth(doc);
    const bottomMargin = doc.page.margins.bottom;
    const y = doc.page.height - bottomMargin + 12;
    // The footer sits inside the bottom margin, and pdfkit starts a new page
    // for anything written past it — so the margin comes off while stamping.
    doc.page.margins.bottom = 0;

    doc
      .moveTo(left, y - 8)
      .lineTo(left + w, y - 8)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();

    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(note, left, y, { width: w * 0.7, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, y, {
      width: w,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = bottomMargin;
  }
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
