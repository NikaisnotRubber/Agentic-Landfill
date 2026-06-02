/** Normalize Helpdesk short_description before hostname / label regex extraction. */
export function normalizeDescriptionText(text: string): string {
  let normalized = text.replace(/\n/g, " ");
  normalized = normalized.replace(/：/g, ":");
  normalized = normalized.replace(/(?<![A-Za-z0-9])(\d+)\.(?![A-Za-z0-9])/g, " $1. ");
  normalized = normalized.replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, "$1 $2");
  normalized = normalized.replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, "$1 $2");
  return normalized;
}
