import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("src/features/ui-examples/ui-examples-pages.tsx", "utf8");

function getFunctionSource(name: string) {
  const exportedSignature = `export function ${name}`;
  const localSignature = `function ${name}`;
  const signature = source.includes(exportedSignature) ? exportedSignature : localSignature;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${name} should exist`);

  const nextFunction = source.indexOf("\nfunction ", start + 1);
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const candidates = [nextFunction, nextExport].filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

describe("ui example search layout", () => {
  it("keeps mobile filter entrypoints icon-only without selected-count badges", () => {
    assert.equal(source.includes("mobileAppliedFilterCount"), false);
    assert.equal(source.includes("\n              Filters\n"), false);
  });

  it("uses the same bottom-sheet filter pattern for searchable example pages", () => {
    const listPage = getFunctionSource("ExampleListPage");
    const cardGridPage = getFunctionSource("ExampleCardGridPage");
    const toolbar = getFunctionSource("ExampleSearchToolbar");

    for (const pageSource of [listPage, cardGridPage]) {
      assert.match(pageSource, /<ExampleSearchToolbar/);
    }

    assert.match(toolbar, /<FilterSheet/);
    assert.match(toolbar, /presentation="mobile-only"/);
    assert.match(toolbar, /size="icon"[\s\S]*aria-label="Filters"/);
  });

  it("uses the shared list pagination wording instead of icon-only pagination", () => {
    const listPage = getFunctionSource("ExampleListPage");

    assert.match(source, /import \{ ListPagination \} from "@magic-admin-v2\/components\/list-pagination"/);
    assert.match(listPage, /<ListPagination[\s\S]*page=\{1\}[\s\S]*pageSize=\{20\}[\s\S]*total=\{items\.length\}/);
    assert.equal(listPage.includes("ChevronLeft"), false);
    assert.equal(listPage.includes("ChevronRight"), false);
  });
});
