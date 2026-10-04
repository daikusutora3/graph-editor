/** Search terms can be entered in any order, using either locale's names. */
export function matchesSampleQuery(query: string, terms: readonly string[]) {
  const normalize = (text: string) =>
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[‐‑–—−]/g, "-");
  const haystack = normalize(terms.join(" "));
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
