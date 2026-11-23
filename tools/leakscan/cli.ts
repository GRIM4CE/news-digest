/**
 * Scans for secrets and personal details. Exits 1 when anything is found.
 *
 *   node tools/leakscan/cli.ts            staged files (the pre-commit hook)
 *   node tools/leakscan/cli.ts --all      every tracked file (CI)
 *   node tools/leakscan/cli.ts <path...>  the given files, skipping ignored ones
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { checkFile, parseTerms, scanText, type Finding } from "./scan.ts";

const TERMS_FILE = ".private-terms";
/** Lockfile hashes are random strings that can look like tokens. */
const CONTENT_EXEMPT = new Set(["package-lock.json"]);

const git = (...args: string[]) =>
  execFileSync("git", args, { maxBuffer: 64 * 1024 * 1024 });
const gitList = (...args: string[]) =>
  git(...args).toString().split("\0").filter(Boolean);
/** `git check-ignore` exits 1 only for a path that is inside the repo and not ignored. */
const isCommittable = (path: string) =>
  existsSync(path) && spawnSync("git", ["check-ignore", "-q", path]).status === 1;

function filesToScan(args: string[]): { file: string; read: () => Buffer }[] {
  if (args.length === 0) {
    return gitList("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").map(
      (file) => ({ file, read: () => git("show", `:${file}`) }),
    );
  }
  const files = args[0] === "--all" ? gitList("ls-files", "-z") : args.filter(isCommittable);
  return files.map((file) => ({ file, read: () => readFileSync(file) }));
}

const terms = parseTerms(
  [
    existsSync(TERMS_FILE) ? readFileSync(TERMS_FILE, "utf8") : "",
    process.env.LEAKSCAN_TERMS ?? "",
  ].join("\n"),
);

const findings: Finding[] = [];
for (const { file, read } of filesToScan(process.argv.slice(2))) {
  const bytes = read();
  findings.push(...checkFile(file, bytes.length));
  const isBinary = bytes.includes(0);
  if (!isBinary && !CONTENT_EXEMPT.has(file)) {
    findings.push(...scanText(file, bytes.toString("utf8"), terms));
  }
}

for (const { file, line, rule } of findings) {
  console.error(`${file}${line ? `:${line}` : ""}  ${rule}`);
}
if (findings.length > 0) {
  console.error(`\nleakscan: ${findings.length} finding(s). Fix them before committing.`);
  process.exit(1);
}
