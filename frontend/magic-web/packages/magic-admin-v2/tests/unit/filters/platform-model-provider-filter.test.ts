import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { providerModelListSearchParam } from "../../../src/features/platform-model-list/types.ts";

const pageSource = readFileSync(
  "src/features/platform-model-list/platform-model-list-page.tsx",
  "utf8",
);
const modelListUtilsSource = readFileSync(
  "src/features/platform-model-list/utils/model-list.ts",
  "utf8",
);
const modelListSource = `${pageSource}\n${modelListUtilsSource}`;
const typeSource = readFileSync(
  "src/features/platform-model-list/types.ts",
  "utf8",
);

describe("platform model provider filter", () => {
  it("keeps the service provider URL parameter name stable", () => {
    assert.equal(
      providerModelListSearchParam.serviceProviderConfigId,
      "service_provider_config_id",
    );
  });

  it("converts the singular URL value to the model group API array filter", () => {
    assert.match(
      pageSource,
      /const \[searchParams\] = useSearchParams\(\);?/u,
    );
    assert.match(
      pageSource,
      /searchParams\.get\(providerModelListSearchParam\.serviceProviderConfigId\)\?\.trim\(\)/u,
    );
    assert.match(
      modelListSource,
      /service_provider_config_ids:\s*serviceProviderConfigId\s*\?\s*\[serviceProviderConfigId\]\s*:\s*\[\]/u,
    );
    assert.match(
      typeSource,
      /service_provider_config_ids\?: string\[\];?/u,
    );
  });

  it("preserves the provider filter when other filters or pagination state change", () => {
    assert.match(
      modelListSource,
      /resolvedActiveCategory,\s*accessibleCategories,\s*nextPage,\s*serviceProviderConfigId,/u,
    );
    assert.match(
      pageSource,
      /extraResetKey: `\$\{resolvedActiveCategory\}:\$\{serviceProviderConfigId\}`/u,
    );
    assert.match(
      pageSource,
      /\[\s*accessibleCategories,\s*resolvedActiveCategory,\s*serviceProviderConfigId,?\s*\]/u,
    );
    assert.equal(pageSource.includes("setPage"), true);
  });
});
