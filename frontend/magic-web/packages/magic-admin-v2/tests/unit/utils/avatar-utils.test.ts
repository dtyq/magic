import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAvatarFallbackText,
  isSafeAvatarImageUrl,
  shouldShowAvatarImage,
} from "../../../src/components/ui/avatar-utils.ts";

describe("avatar utils", () => {
  it("uses one visible fallback character for names and abbreviations", () => {
    assert.equal(getAvatarFallbackText("Alice"), "A");
    assert.equal(getAvatarFallbackText("alice"), "A");
    assert.equal(getAvatarFallbackText("Alice Chen"), "A");
    assert.equal(getAvatarFallbackText("张三"), "张");
    assert.equal(getAvatarFallbackText("42 Labs"), "4");
    assert.equal(getAvatarFallbackText("AB"), "A");
  });

  it("uses the fallback marker for empty values", () => {
    assert.equal(getAvatarFallbackText(""), "?");
    assert.equal(getAvatarFallbackText("   "), "?");
    assert.equal(getAvatarFallbackText("-"), "?");
    assert.equal(getAvatarFallbackText(undefined), "?");
  });

  it("only accepts browser-safe avatar image urls", () => {
    assert.equal(isSafeAvatarImageUrl("https://example.com/a.png"), true);
    assert.equal(isSafeAvatarImageUrl("http://example.com/a.png"), true);
    assert.equal(isSafeAvatarImageUrl("/assets/avatar.png"), true);
    assert.equal(isSafeAvatarImageUrl("data:image/png;base64,abc"), true);
    assert.equal(isSafeAvatarImageUrl("blob:https://example.com/avatar"), true);
    assert.equal(isSafeAvatarImageUrl("javascript:alert(1)"), false);
    assert.equal(isSafeAvatarImageUrl("relative/avatar.png"), false);
  });

  it("does not show a failed avatar image again until the source changes", () => {
    assert.equal(shouldShowAvatarImage("https://example.com/a.png", false), true);
    assert.equal(shouldShowAvatarImage("https://example.com/a.png", true), false);
    assert.equal(shouldShowAvatarImage("javascript:alert(1)", false), false);
  });
});
