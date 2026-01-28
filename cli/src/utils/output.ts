/**
 * Formatting and output utilities for CLI
 */

export function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return "";
  }

  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map((r) => String(r[i] || "").length));
    return Math.max(h.length, maxRowWidth);
  });

  const separator = colWidths.map((w) => "-".repeat(w + 2)).join("+");
  const headerRow = headers
    .map((h, i) => ` ${h.padEnd(colWidths[i])} `)
    .join("|");
  const dataRows = rows
    .map((row) =>
      row.map((cell, i) => ` ${String(cell || "").padEnd(colWidths[i])} `).join("|")
    )
    .join("\n");

  return `${headerRow}\n${separator}\n${dataRows}`;
}

export function formatJSON(data: unknown, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

export function success(message: string): void {
  console.log(`✓ ${message}`);
}

export function error(message: string): void {
  console.error(`✗ Error: ${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function warning(message: string): void {
  console.warn(`⚠ Warning: ${message}`);
}
