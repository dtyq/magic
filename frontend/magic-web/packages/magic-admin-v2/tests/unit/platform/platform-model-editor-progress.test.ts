import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const editorSource = readFileSync(
  "src/features/platform-model-list/components/model-editor-dialog.tsx",
  "utf8",
);

describe("platform model editor progress dialog", () => {
  it("only shows the provider loading progress for models with multiple providers", () => {
    assert.equal(
      editorSource.includes("const shouldShowLoadProgress = allRecordIds.length >= 2;"),
      true,
    );
    assert.equal(
      editorSource.includes("if (shouldShowLoadProgress) {\n      setProgress({"),
      true,
    );
    assert.equal(
      editorSource.includes("if (shouldShowLoadProgress) {\n        setProgress({"),
      true,
    );
  });

  it("unmounts the nested progress dialog before closing the editor", () => {
    const functionStart = editorSource.indexOf("function closeProgressDialog()");
    const functionEnd = editorSource.indexOf("function handleRemoveProvider", functionStart);
    const closeProgressSource = editorSource.slice(functionStart, functionEnd);
    const clearProgressIndex = closeProgressSource.indexOf("setProgress(null)");
    const scheduleCloseIndex = closeProgressSource.indexOf("window.requestAnimationFrame");

    assert.notEqual(functionStart, -1);
    assert.notEqual(functionEnd, -1);
    assert.equal(
      closeProgressSource.includes(
        'const shouldCloseEditor = progress.kind === "load" || !progress.failed;',
      ),
      true,
    );
    assert.equal(clearProgressIndex >= 0, true);
    assert.equal(scheduleCloseIndex > clearProgressIndex, true);
    assert.equal(
      closeProgressSource.includes("window.requestAnimationFrame(() => onOpenChange(false))"),
      true,
    );
  });
});
