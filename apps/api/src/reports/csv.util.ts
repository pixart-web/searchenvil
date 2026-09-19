/**
 * RFC 4180 field escaping: wrap in quotes and double any embedded quote
 * whenever the field contains a comma, quote, or newline. Anything else is
 * left bare.
 */
function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
