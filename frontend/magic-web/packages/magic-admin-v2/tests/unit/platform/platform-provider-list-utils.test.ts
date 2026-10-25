import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultProviderFilterDraft,
  filterProviders,
  getProviderStatusStats,
  paginateProviders,
  providerPageSize,
  sortProviders,
} from "../../../src/features/platform-provider-list/utils/provider-list.ts";
import {
  providerCategory,
  providerSelectAllValue,
  providerStatus,
  providerType,
  type ProviderListItem,
} from "../../../src/features/platform-provider-list/types.ts";

function createProvider(
  id: string,
  overrides: Partial<ProviderListItem> = {},
): ProviderListItem {
  return {
    id,
    name: `Provider ${id}`,
    alias: `Alias ${id}`,
    sort: 0,
    status: providerStatus.enabled,
    service_provider_id: `template-${id}`,
    provider_code: `Code-${id}`,
    provider_type: providerType.nonOfficial,
    category: providerCategory.llm,
    ...overrides,
  };
}

describe("platform provider list utils", () => {
  it("creates the all/name default filter with independent search fields", () => {
    assert.deepEqual(createDefaultProviderFilterDraft(), {
      alias: "",
      name: "",
      id: "",
      provider_type: providerSelectAllValue,
      status: providerSelectAllValue,
    });
  });

  it("sorts official providers first, then enabled state and ascending sort", () => {
    const original = [
      createProvider("disabled-low", { status: providerStatus.disabled, sort: 1 }),
      createProvider("enabled-high", { sort: 20 }),
      createProvider("official-disabled", {
        provider_type: providerType.official,
        status: providerStatus.disabled,
        sort: 99,
      }),
      createProvider("enabled-low", { sort: 2 }),
    ];

    assert.deepEqual(
      sortProviders(original).map((item) => item.id),
      ["official-disabled", "enabled-low", "enabled-high", "disabled-low"],
    );
    assert.deepEqual(
      original.map((item) => item.id),
      ["disabled-low", "enabled-high", "official-disabled", "enabled-low"],
    );
  });

  it("searches name, alias, and provider ID independently and case-insensitively", () => {
    const items = [
      createProvider("openai", {
        name: "OpenAI",
        alias: "Primary GPT",
        provider_code: "different-code",
      }),
      createProvider("azure", {
        name: "Microsoft Azure",
        alias: "Enterprise Cloud",
        provider_code: "different-azure-code",
      }),
    ];
    const baseFilter = createDefaultProviderFilterDraft();

    assert.deepEqual(
      filterProviders(items, { ...baseFilter, name: " open " }).map((item) => item.id),
      ["openai"],
    );
    assert.deepEqual(
      filterProviders(items, {
        ...baseFilter,
        alias: "CLOUD",
      }).map((item) => item.id),
      ["azure"],
    );
    assert.deepEqual(
      filterProviders(items, {
        ...baseFilter,
        id: "openai",
      }).map((item) => item.id),
      ["openai"],
    );
    assert.deepEqual(
      filterProviders([
        { ...items[0], id: "config-openai", service_provider_id: "template-other" },
      ], {
        ...baseFilter,
        provider_id: "CONFIG-OPENAI",
      }).map((item) => item.id),
      ["config-openai"],
    );
  });

  it("combines status, provider type, and text filters", () => {
    const items = [
      createProvider("official-enabled", { provider_type: providerType.official }),
      createProvider("custom-enabled", {
        name: "Custom Match",
        provider_type: providerType.custom,
      }),
      createProvider("custom-disabled", {
        name: "Custom Match Disabled",
        provider_type: providerType.custom,
        status: providerStatus.disabled,
      }),
    ];

    assert.deepEqual(
      filterProviders(items, {
        name: "match",
        provider_id: "",
        provider_type: String(providerType.custom),
        status: String(providerStatus.enabled),
      }).map((item) => item.id),
      ["custom-enabled"],
    );
  });

  it("handles empty optional search values without matching unrelated fields", () => {
    const item = createProvider("empty-alias", { alias: undefined });
    const filter = createDefaultProviderFilterDraft();

    assert.deepEqual(
      filterProviders([item], { ...filter, alias: "provider" }),
      [],
    );
  });

  it("paginates with the shared page size and clamps invalid pages", () => {
    const items = Array.from({ length: providerPageSize + 3 }, (_, index) => index + 1);

    assert.deepEqual(paginateProviders(items, 2), {
      currentPage: 2,
      pageItems: [providerPageSize + 1, providerPageSize + 2, providerPageSize + 3],
      totalPages: 2,
    });
    assert.deepEqual(paginateProviders(items, 99).currentPage, 2);
    assert.deepEqual(paginateProviders(items, 0).currentPage, 1);
    assert.deepEqual(paginateProviders([], 4), {
      currentPage: 1,
      pageItems: [],
      totalPages: 1,
    });
  });

  it("calculates enabled, disabled, and total statistics", () => {
    assert.deepEqual(
      getProviderStatusStats([
        createProvider("enabled-1"),
        createProvider("enabled-2"),
        createProvider("disabled", { status: providerStatus.disabled }),
      ]),
      { enabled: 2, disabled: 1, total: 3 },
    );
  });
});
