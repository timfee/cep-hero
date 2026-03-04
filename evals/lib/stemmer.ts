/**
 * Lightweight Porter stemmer for English word normalization.
 * Reduces morphological variants to a common root so evidence matching
 * equates "increase"/"increasing", "corrupt"/"corruption", "deny"/"denied".
 *
 * Based on Porter (1980) "An algorithm for suffix stripping".
 * Reference: https://tartarus.org/martin/PorterStemmer/def.txt
 */

/**
 * Check if character at position i is a consonant in context.
 * Treats 'y' as vowel when preceded by a consonant.
 */
function isConsonant(word: string, i: number): boolean {
  const ch = word[i];
  if (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u") {
    return false;
  }
  if (ch === "y") {
    return i === 0 || !isConsonant(word, i - 1);
  }
  return true;
}

/**
 * Count consonant-vowel sequences (the "measure" m) in a word.
 * Example: "trouble" has m=1 (tr-oubl), "troubles" has m=2 (tr-oubl-es).
 */
function measure(word: string): number {
  let m = 0;
  let i = 0;
  const len = word.length;

  while (i < len && isConsonant(word, i)) {
    i += 1;
  }

  while (i < len) {
    while (i < len && !isConsonant(word, i)) {
      i += 1;
    }
    if (i >= len) {
      break;
    }
    m += 1;
    while (i < len && isConsonant(word, i)) {
      i += 1;
    }
  }

  return m;
}

/**
 * Check if word contains at least one vowel.
 */
function hasVowel(word: string): boolean {
  for (let i = 0; i < word.length; i += 1) {
    if (!isConsonant(word, i)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if word ends with a doubled consonant (e.g., "hopp", "tann").
 */
function endsDoubleC(word: string): boolean {
  const len = word.length;
  return (
    len >= 2 && word[len - 1] === word[len - 2] && isConsonant(word, len - 1)
  );
}

/**
 * Check if word ends with consonant-vowel-consonant where final C is not w/x/y.
 */
function endsCVC(word: string): boolean {
  const len = word.length;
  if (len < 3) {
    return false;
  }
  return (
    isConsonant(word, len - 1) &&
    !isConsonant(word, len - 2) &&
    isConsonant(word, len - 3) &&
    word[len - 1] !== "w" &&
    word[len - 1] !== "x" &&
    word[len - 1] !== "y"
  );
}

/**
 * Apply step 2 suffix replacement rules.
 */
function applyStep2(stem: string): string {
  const rules: [string, string][] = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["izer", "ize"],
    ["ization", "ize"],
    ["ation", "ate"],
    ["ator", "ate"],
    ["alism", "al"],
    ["iveness", "ive"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["aliti", "al"],
    ["iviti", "ive"],
    ["biliti", "ble"],
    ["eli", "e"],
    ["ousli", "ous"],
    ["entli", "ent"],
    ["alli", "al"],
    ["abli", "able"],
  ];

  for (const [suffix, replacement] of rules) {
    if (stem.endsWith(suffix)) {
      const base = stem.slice(0, -suffix.length);
      if (measure(base) > 0) {
        return base + replacement;
      }
      return stem;
    }
  }
  return stem;
}

/**
 * Apply step 3 suffix replacement rules.
 */
function applyStep3(stem: string): string {
  const rules: [string, string][] = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""],
  ];

  for (const [suffix, replacement] of rules) {
    if (stem.endsWith(suffix)) {
      const base = stem.slice(0, -suffix.length);
      if (measure(base) > 0) {
        return base + replacement;
      }
      return stem;
    }
  }
  return stem;
}

/**
 * Apply step 4: remove suffixes where measure > 1.
 */
function applyStep4(stem: string): string {
  if (stem.endsWith("ion")) {
    const base = stem.slice(0, -3);
    if (measure(base) > 1 && (base.endsWith("s") || base.endsWith("t"))) {
      return base;
    }
    return stem;
  }

  const suffixes = [
    "al",
    "ance",
    "ence",
    "er",
    "ic",
    "able",
    "ible",
    "ant",
    "ement",
    "ment",
    "ent",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
  ];

  for (const suffix of suffixes) {
    if (stem.endsWith(suffix)) {
      const base = stem.slice(0, -suffix.length);
      if (measure(base) > 1) {
        return base;
      }
      return stem;
    }
  }
  return stem;
}

/**
 * Apply step 1a: strip common plural suffixes.
 */
function applyStep1a(stem: string): string {
  if (stem.endsWith("sses")) {
    return stem.slice(0, -2);
  }
  if (stem.endsWith("ies")) {
    return stem.slice(0, -2);
  }
  if (!stem.endsWith("ss") && stem.endsWith("s")) {
    return stem.slice(0, -1);
  }
  return stem;
}

/**
 * Fix up stem after -ed/-ing removal: restore 'e' for short stems, trim double consonants.
 */
function fixupStep1b(stem: string): string {
  if (stem.endsWith("at") || stem.endsWith("bl") || stem.endsWith("iz")) {
    return `${stem}e`;
  }
  if (endsDoubleC(stem) && !/[lsz]$/.test(stem)) {
    return stem.slice(0, -1);
  }
  if (measure(stem) === 1 && endsCVC(stem)) {
    return `${stem}e`;
  }
  return stem;
}

/**
 * Apply step 1b: strip -eed, -ed, -ing with post-fixup for short stems.
 */
function applyStep1b(input: string): string {
  if (input.endsWith("eed")) {
    return measure(input.slice(0, -3)) > 0 ? input.slice(0, -1) : input;
  }

  if (input.endsWith("ed")) {
    const base = input.slice(0, -2);
    return hasVowel(base) ? fixupStep1b(base) : input;
  }

  if (input.endsWith("ing")) {
    const base = input.slice(0, -3);
    return hasVowel(base) ? fixupStep1b(base) : input;
  }

  return input;
}

/**
 * Apply step 1: handle plurals, past tense, progressive, and terminal y.
 */
function applyStep1(input: string): string {
  let stem = applyStep1a(input);
  stem = applyStep1b(stem);

  // Step 1c: terminal y → i when stem has vowel
  if (stem.endsWith("y") && hasVowel(stem.slice(0, -1))) {
    stem = `${stem.slice(0, -1)}i`;
  }

  return stem;
}

/**
 * Apply step 5: clean up trailing 'e' and double 'l'.
 */
function applyStep5(input: string): string {
  let stem = input;

  // Step 5a: remove trailing 'e'
  if (stem.endsWith("e")) {
    const base = stem.slice(0, -1);
    const m = measure(base);
    if (m > 1 || (m === 1 && !endsCVC(base))) {
      stem = base;
    }
  }

  // Step 5b: reduce trailing double 'l'
  if (stem.endsWith("ll") && measure(stem) > 1) {
    stem = stem.slice(0, -1);
  }

  return stem;
}

/**
 * Stem an English word using the Porter algorithm (steps 1–5).
 * Words shorter than 4 characters are returned unchanged.
 */
export function porterStem(word: string): string {
  if (word.length < 4) {
    return word;
  }

  let stem = applyStep1(word);
  stem = applyStep2(stem);
  stem = applyStep3(stem);
  stem = applyStep4(stem);
  stem = applyStep5(stem);

  return stem;
}

/**
 * Stem each word in a space-separated string.
 */
export function stemText(text: string): string {
  return text
    .split(" ")
    .map((w) => (w.length > 0 ? porterStem(w) : w))
    .join(" ");
}
