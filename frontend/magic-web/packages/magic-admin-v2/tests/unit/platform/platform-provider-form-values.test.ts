import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyProviderTemplateSelection,
  createEmptyProviderFormValues,
  toAddProviderParams,
  toEditProviderParams,
  toProviderFormValues,
  toProviderStatusUpdateParams,
} from "../../../src/features/platform-provider-list/utils/provider-form-values.ts";
import {
  providerCategory,
  providerStatus,
  providerType,
  type ProviderFormValues,
  type ProviderListItem,
  type ProviderTemplate,
} from "../../../src/features/platform-provider-list/types.ts";

function createProvider(overrides: Partial<ProviderListItem> = {}): ProviderListItem {
  return {
    id: "provider-config-1",
    name: "OpenAI",
    alias: "OpenAI CN",
    sort: 4,
    status: providerStatus.enabled,
    service_provider_id: "template-openai",
    provider_code: "OpenAI",
    provider_type: providerType.nonOfficial,
    category: providerCategory.llm,
    config: {
      api_key: "masked-key",
      url: "https://custom.example.com/v1",
    },
    translate: {
      alias: {
        zh_CN: "OpenAI CN",
        en_US: "OpenAI EN",
        vi_VN: "OpenAI VI",
      },
    },
    ...overrides,
  };
}

function createTemplate(overrides: Partial<ProviderTemplate> = {}): ProviderTemplate {
  return {
    id: "template-openai",
    name: "OpenAI",
    provider_code: "OpenAI",
    provider_type: providerType.official,
    category: providerCategory.llm,
    ...overrides,
  };
}

function createFormValues(overrides: Partial<ProviderFormValues> = {}): ProviderFormValues {
  return {
    service_provider_id: "template-openai",
    alias: "  新别名  ",
    alias_en: "  New Alias  ",
    sort: 8,
    status: true,
    config: {
      api_key: "  sk-test  ",
      url: "  https://api.openai.com/v1  ",
      empty: "  ",
    },
    ...overrides,
  };
}

describe("platform provider form values and payloads", () => {
  it("creates a stable empty form state", () => {
    assert.deepEqual(createEmptyProviderFormValues(), {
      service_provider_id: "",
      alias: "",
      alias_en: "",
      sort: 0,
      status: true,
      config: {},
    });
  });

  it("hydrates detail values and lets persisted config override default URLs", () => {
    assert.deepEqual(toProviderFormValues(createProvider()), {
      service_provider_id: "template-openai",
      alias: "OpenAI CN",
      alias_en: "OpenAI EN",
      sort: 4,
      status: true,
      config: {
        url: "https://custom.example.com/v1",
        api_key: "masked-key",
      },
    });
  });

  it("resets stale config when selecting another provider template", () => {
    const values = createFormValues({
      config: { api_key: "stale-key", url: "https://stale.example.com" },
    });
    const template = createTemplate({
      id: "template-deepseek",
      name: "DeepSeek",
      provider_code: "DeepSeek",
    });

    assert.deepEqual(applyProviderTemplateSelection(values, template), {
      ...values,
      service_provider_id: "template-deepseek",
      config: { url: "https://api.deepseek.com" },
    });
  });

  it("builds a normalized add payload with localized aliases", () => {
    assert.deepEqual(toAddProviderParams(createFormValues(), createTemplate()), {
      alias: "新别名",
      config: {
        api_key: "sk-test",
        url: "https://api.openai.com/v1",
      },
      service_provider_id: "template-openai",
      status: providerStatus.enabled,
      translate: {
        alias: {
          zh_CN: "新别名",
          en_US: "New Alias",
        },
      },
    });
  });

  it("builds an edit payload while preserving unrelated historical translations", () => {
    assert.deepEqual(toEditProviderParams(createProvider(), createFormValues()), {
      id: "provider-config-1",
      status: providerStatus.enabled,
      config: {
        api_key: "sk-test",
        url: "https://api.openai.com/v1",
      },
      alias: "新别名",
      sort: 8,
      provider_code: "OpenAI",
      translate: {
        alias: {
          zh_CN: "新别名",
          en_US: "New Alias",
          vi_VN: "OpenAI VI",
        },
      },
    });
  });

  it("removes an empty English alias from the serialized edit payload", () => {
    assert.deepEqual(
      toEditProviderParams(createProvider(), createFormValues({ alias_en: "" })).translate,
      {
        alias: {
          zh_CN: "新别名",
          en_US: undefined,
          vi_VN: "OpenAI VI",
        },
      },
    );
  });

  it("builds row status updates without dropping saved provider configuration", () => {
    const provider = createProvider();

    assert.deepEqual(toProviderStatusUpdateParams(provider, false), {
      id: "provider-config-1",
      status: providerStatus.disabled,
      config: provider.config,
      alias: "OpenAI CN",
      sort: 4,
      provider_code: "OpenAI",
      translate: provider.translate,
    });
  });
});
