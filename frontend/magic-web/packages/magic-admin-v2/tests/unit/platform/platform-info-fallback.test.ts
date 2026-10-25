import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlatformPermissionDeniedError } from "../../../src/api/types";
import { createDefaultPlatformInfoDetails } from "../../../src/features/platform-info/api";

describe("platform info fallback", () => {
  it("recognizes platform permission errors without treating login expiry as a fallback", () => {
    assert.equal(isPlatformPermissionDeniedError({ code: 70007 }), true);
    assert.equal(isPlatformPermissionDeniedError({ status: 403 }), true);
    assert.equal(isPlatformPermissionDeniedError({ status: 401 }), false);
  });

  it("provides an empty platform configuration for fallback branding", () => {
    const fallback = createDefaultPlatformInfoDetails();

    assert.deepEqual(fallback.logo, { zh_CN: "", en_US: "" });
    assert.equal(fallback.favicon, null);
    assert.equal(fallback.minimal_logo, null);
    assert.equal(fallback.default_language, "zh_CN");
    assert.equal(fallback.global_system_prompt, "");
    assert.equal(fallback.footer?.filing.enabled, false);
    assert.deepEqual(fallback.watermark, {
      enabled: false,
      fields: ["real_name"],
      depth: "light",
    });
  });
});
