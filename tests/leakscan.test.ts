import { describe, expect, it } from "vitest";
import { checkFile, parseTerms, scanText } from "../tools/leakscan/scan.ts";

// Samples are assembled from parts so this file passes its own scan.
const email = ["jane.roe", "mail.test"].join("@");
const homePath = ["", "Users", "jane", "code"].join("/");
const token = "ghp_" + "a".repeat(36);
const ssn = ["123", "45", "6789"].join("-");
const keyHeader = ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ");

const rules = (text: string, terms?: string[]) =>
  scanText("f.ts", text, terms).map((finding) => finding.rule);

describe("scanText", () => {
  it("flags emails, home paths, tokens, keys, and SSNs with their line", () => {
    const text = ["clean", email, homePath, token, keyHeader, ssn].join("\n");
    expect(scanText("f.ts", text)).toEqual([
      { file: "f.ts", line: 2, rule: "email address" },
      { file: "f.ts", line: 3, rule: "home-folder path" },
      { file: "f.ts", line: 4, rule: "API token" },
      { file: "f.ts", line: 5, rule: "private key" },
      { file: "f.ts", line: 6, rule: "US social security number" },
    ]);
  });

  it("allows placeholders and things that only look like leaks", () => {
    const fine = [
      "reader@example.com and git@github.com:owner/repo.git",
      "typescript-eslint@8.73.0 and @anthropic-ai/sdk",
      "home-folder paths (`/Users/...`) and https://example.com/home/page",
    ];
    expect(rules(fine.join("\n"))).toEqual([]);
  });

  it("flags private terms in any case without naming them", () => {
    expect(rules("Written by JANE ROE", ["jane roe"])).toEqual(["private term"]);
  });
});

describe("parseTerms", () => {
  it("drops comments, blanks, and terms too short to be safe", () => {
    expect(parseTerms("# names\nJane Roe\n\nab\n  Springfield ")).toEqual([
      "jane roe",
      "springfield",
    ]);
  });
});

describe("checkFile", () => {
  it("blocks data files and oversized files, but not the lockfile", () => {
    expect(checkFile("export.csv", 10)).toHaveLength(1);
    expect(checkFile("src/big.ts", 600_000)).toHaveLength(1);
    expect(checkFile("package-lock.json", 600_000)).toEqual([]);
    expect(checkFile("src/ok.ts", 10)).toEqual([]);
  });
});
