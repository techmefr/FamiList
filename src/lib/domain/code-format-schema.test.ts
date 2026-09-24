import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_TYPES } from "./code-format";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

const lastCodeTypeCheck = () => {
  const checks = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) => [
      ...readFileSync(join(MIGRATIONS, file), "utf8").matchAll(
        /check \(code_type in \(([^)]*)\)\)/g,
      ),
    ]);
  const last = checks.at(-1);
  if (!last) throw new Error("no code_type check found in the migrations");
  return [...last[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
};

describe("loyalty_cards.code_type check", () => {
  it("accepts every format the app can scan or pick", () => {
    expect(lastCodeTypeCheck()).toEqual([...CODE_TYPES].sort());
  });
});
