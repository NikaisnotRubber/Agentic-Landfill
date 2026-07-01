import { readFileSync } from "node:fs";
import path from "node:path";

import type { MappingExportSchema } from "./loadMappingExportSchema";
import { validateMappingExportSchema } from "./validateMappingExportSchema";

const DEFAULT_SCHEMA_PATH = path.resolve(
  process.cwd(),
  "docs/superpowers/fixtures/mapping-export-schema.json",
);

let cachedSchema: MappingExportSchema | null = null;

export function loadMappingExportSchemaSync(
  schemaPath = DEFAULT_SCHEMA_PATH,
): MappingExportSchema {
  if (cachedSchema && schemaPath === DEFAULT_SCHEMA_PATH) {
    return cachedSchema;
  }

  const raw = readFileSync(schemaPath, "utf8");
  const parsed = validateMappingExportSchema(JSON.parse(raw) as MappingExportSchema);

  if (schemaPath === DEFAULT_SCHEMA_PATH) {
    cachedSchema = parsed;
  }

  return parsed;
}

export function resetMappingExportSchemaCache(): void {
  cachedSchema = null;
}
