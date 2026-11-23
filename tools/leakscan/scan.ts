export interface Finding {
  file: string;
  /** 1-based line number, or 0 when the whole file is the problem. */
  line: number;
  /** What was found. Never contains the matched text itself. */
  rule: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  /** Matches this returns true for are fine (placeholders and the like). */
  allow?: (match: string) => boolean;
}

const SAFE_EMAIL = /^(git|noreply)@|@example\.(com|org|net)$|\.noreply\.github\.com$/i;

const RULES: Rule[] = [
  {
    name: "email address",
    pattern: /[\w.+-]+@[\w-]+(\.[\w-]+)*\.[A-Za-z]{2,}/g,
    allow: (match) => SAFE_EMAIL.test(match),
  },
  {
    name: "home-folder path",
    pattern: /(?<![\w.])\/(Users|home)\/[A-Za-z0-9][\w.-]*|[A-Za-z]:\\Users\\[A-Za-z0-9]/g,
  },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: "API token",
    pattern:
      /\b(sk-ant-[\w-]{20,}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16})\b/g,
  },
  { name: "US social security number", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

/** Data and key files that should never be committed, whatever they contain. */
const BLOCKED_EXTENSIONS =
  /\.(csv|tsv|sql|sqlite|db|parquet|ipynb|log|pem|key|p12)$/i;
const MAX_BYTES = 500_000;
const SIZE_EXEMPT = new Set(["package-lock.json"]);

/** One term per line; blank lines and # comments are ignored. */
export function parseTerms(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 3 && !line.startsWith("#"));
}

/** Check a file's path and size, before looking at what is in it. */
export function checkFile(file: string, bytes: number): Finding[] {
  if (BLOCKED_EXTENSIONS.test(file)) {
    return [{ file, line: 0, rule: "data or key file type" }];
  }
  if (bytes > MAX_BYTES && !SIZE_EXEMPT.has(file)) {
    return [{ file, line: 0, rule: `larger than ${MAX_BYTES / 1000} kB` }];
  }
  return [];
}

/**
 * Scan text for secrets and personal details. `terms` are private words
 * (names, usernames, places) kept out of the repo and matched case-insensitively.
 */
export function scanText(file: string, text: string, terms: string[] = []): Finding[] {
  const findings: Finding[] = [];
  text.split("\n").forEach((content, index) => {
    const line = index + 1;
    for (const { name, pattern, allow } of RULES) {
      const matches = content.match(pattern) ?? [];
      if (matches.some((match) => !allow?.(match))) {
        findings.push({ file, line, rule: name });
      }
    }
    const lower = content.toLowerCase();
    if (terms.some((term) => lower.includes(term))) {
      findings.push({ file, line, rule: "private term" });
    }
  });
  return findings;
}
