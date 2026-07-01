import { parse } from "csv-parse/sync";

export type CsvRecord = Record<string, string>;

export function parseCsvRecords(input: string): CsvRecord[] {
  return parse(input, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}
