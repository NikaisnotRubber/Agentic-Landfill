/**
 * Notebook heuristic: single-character LastName means first/last were swapped.
 * @see Mapping ADGroup、Zentera/docs/ddp_analysis_review.md
 */
export function repairSwappedUserNames(firstName: string, lastName: string): {
  firstName: string;
  lastName: string;
} {
  const first = firstName.trim();
  const last = lastName.trim();

  if (last.length === 1 && first.length > 1) {
    return { firstName: last, lastName: first };
  }

  return { firstName: first, lastName: last };
}
