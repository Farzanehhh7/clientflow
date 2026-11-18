/** Normalize Arabic/Persian characters, half-spaces (ZWNJ), diacritics, and digits */
export function normalizePersian(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يیى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics & tatweel
    .replace(/\u200C/g, '') // remove ZWNJ (half-space)
    .replace(/\s+/g, ' ');
}

export function compactPersian(input: string): string {
  return normalizePersian(input).replace(/\s+/g, '');
}

/** Bounded Levenshtein distance for typo-tolerant Persian search */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prev = Array.from({ length: bl + 1 }, (_, j) => j);
  for (let i = 1; i <= al; i++) {
    const curr = [i];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[bl];
}

/** Fuzzy match supporting half-space differences, Arabic/Persian letter variants, and minor typos */
export function fuzzyMatchPersian(fields: (string | undefined)[], query: string): boolean {
  const qNorm = normalizePersian(query);
  if (!qNorm) return true;
  const qCompact = qNorm.replace(/\s+/g, '');

  const joined = fields.filter(Boolean).join(' ');
  const hNorm = normalizePersian(joined);
  const hCompact = hNorm.replace(/\s+/g, '');

  if (hNorm.includes(qNorm) || hCompact.includes(qCompact)) {
    return true;
  }

  const queryTokens = qNorm.split(' ').filter((t) => t.length >= 2);
  const hayTokens = hNorm.split(' ').filter((t) => t.length >= 2);
  if (queryTokens.length === 0 || hayTokens.length === 0) return false;

  return queryTokens.every((qt) => {
    const maxDist = qt.length >= 6 ? 2 : qt.length >= 3 ? 1 : 0;
    return hayTokens.some((ht) => {
      if (ht.includes(qt)) return true;
      if (maxDist === 0) return false;
      if (Math.abs(ht.length - qt.length) > maxDist) return false;
      return levenshtein(qt, ht) <= maxDist;
    });
  });
}
