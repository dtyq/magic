import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultProviderConfig,
  getProviderConfigFields,
  isValidProviderEmail,
  mergeGoogleServiceAccountConfig,
  normalizeProviderConfig,
  parseGoogleServiceAccountJson,
  shouldShowProviderConfigField,
} from "../../../src/features/platform-provider-list/utils/provider-config.ts";
import {
  providerAuthType,
  providerCategory,
  providerType,
  type ProviderTemplate,
} from "../../../src/features/platform-provider-list/types.ts";

const translate = (key: string) => key;

function createProvider(
  category: ProviderTemplate["category"],
  providerCode: string,
): ProviderTemplate {
  return {
    id: `${category}-${providerCode}`,
    name: providerCode,
    provider_code: providerCode,
    provider_type: providerType.official,
    category,
  };
}

function getFieldKeys(provider: ProviderTemplate) {
  return getProviderConfigFields(provider, translate).map((field) => field.key);
}

function getVisibleFieldKeys(provider: ProviderTemplate, authType: string) {
  return getProviderConfigFields(provider, translate)
    .filter((field) => shouldShowProviderConfigField(field, provider, authType))
    .map((field) => field.key);
}

describe("platform provider config mapping", () => {
  it("uses AK/SK for the legacy Volcengine VLM provider", () => {
    const provider = createProvider(providerCategory.vlm, "Volcengine");

    assert.deepEqual(getFieldKeys(provider), ["ak", "sk"]);
    assert.deepEqual(createDefaultProviderConfig(provider), {});
  });

  it("uses AK/SK for the MiracleVision VLM provider", () => {
    const provider = createProvider(providerCategory.vlm, "MiracleVision");

    assert.deepEqual(getFieldKeys(provider), ["ak", "sk"]);
  });

  it("keeps VolcengineArk on API Key and API URL", () => {
    const provider = createProvider(providerCategory.vlm, "VolcengineArk");

    assert.deepEqual(getFieldKeys(provider), ["api_key", "url"]);
    assert.deepEqual(createDefaultProviderConfig(provider), {
      url: "https://ark.cn-beijing.volces.com/api/v3",
    });
  });

  it("does not apply the VLM Volcengine rule to another category", () => {
    const provider = createProvider(providerCategory.llm, "Volcengine");

    assert.deepEqual(getFieldKeys(provider), ["api_key", "url"]);
  });

  it("keeps AWS Bedrock on AK/SK/Region", () => {
    const provider = createProvider(providerCategory.llm, "AWSBedrock");

    assert.deepEqual(getFieldKeys(provider), ["ak", "sk", "region"]);
  });

  it("keeps Azure API Version in both LLM and VLM categories", () => {
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.llm, "MicrosoftAzure")),
      ["api_key", "url", "api_version"],
    );
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.vlm, "MicrosoftAzure")),
      ["api_key", "url", "api_version"],
    );
  });

  it("keeps Anthropic API Version only in the LLM mapping", () => {
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.llm, "Anthropic")),
      ["api_key", "url", "api_version"],
    );
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.vlm, "Anthropic")),
      ["api_key", "url"],
    );
  });

  it("uses API Key and API URL for default and VGM providers", () => {
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.llm, "UnknownProvider")),
      ["api_key", "url"],
    );
    assert.deepEqual(
      getFieldKeys(createProvider(providerCategory.vgm, "Cloudsway")),
      ["api_key", "url"],
    );
  });

  it("switches Google fields between API Key and Service Account modes", () => {
    const provider = createProvider(providerCategory.llm, "Google");

    assert.deepEqual(getVisibleFieldKeys(provider, providerAuthType.apiKey), ["api_key", "url"]);
    assert.deepEqual(getVisibleFieldKeys(provider, providerAuthType.serviceAccount), [
      "project_id",
      "private_key_id",
      "private_key",
      "client_email",
      "client_id",
      "location",
      "api_key",
      "url",
    ]);
  });

  it("provides the same default URLs as the legacy provider form", () => {
    assert.deepEqual(
      createDefaultProviderConfig(createProvider(providerCategory.llm, "OpenAI")),
      { url: "https://api.openai.com/v1" },
    );
    assert.deepEqual(
      createDefaultProviderConfig(createProvider(providerCategory.vgm, "Keling")),
      { url: "https://api.klingai.com" },
    );
  });

  it("removes incompatible credential fields before submitting legacy VLM providers", () => {
    const provider = createProvider(providerCategory.vlm, "Volcengine");

    assert.deepEqual(
      normalizeProviderConfig(
        {
          ak: " access-key ",
          sk: " secret-key ",
          api_key: "stale-api-key",
          url: "https://stale.example.com",
        },
        provider,
      ),
      {
        ak: "access-key",
        sk: "secret-key",
      },
    );
  });

  it("preserves the legacy proxy server config payload", () => {
    const provider = createProvider(providerCategory.llm, "OpenAI");

    assert.deepEqual(
      normalizeProviderConfig(
        {
          api_key: " sk-test ",
          use_proxy: true,
          proxy_server: { id: "proxy-1", name: "Main Proxy" },
        },
        provider,
      ),
      {
        api_key: "sk-test",
        use_proxy: true,
        proxy_server: { id: "proxy-1", name: "Main Proxy" },
      },
    );
  });

  it("preserves legacy and imported provider config fields that are not rendered", () => {
    const provider = createProvider(providerCategory.llm, "Google");

    assert.deepEqual(
      normalizeProviderConfig(
        {
          auth_type: providerAuthType.serviceAccount,
          deployment_name: " deployment ",
          gcs_bucket: " bucket ",
          vector_size: 2048,
        },
        provider,
      ),
      {
        auth_type: providerAuthType.serviceAccount,
        deployment_name: "deployment",
        gcs_bucket: "bucket",
        vector_size: 2048,
      },
    );
  });

  it("parses Google Service Account JSON as provider config", () => {
    assert.deepEqual(
      parseGoogleServiceAccountJson(
        JSON.stringify({
          client_email: "service-account@example.com",
          private_key: "private-key",
          project_id: "project-id",
        }),
      ),
      {
        client_email: "service-account@example.com",
        private_key: "private-key",
        project_id: "project-id",
      },
    );
    assert.throws(() => parseGoogleServiceAccountJson("[]"));
    assert.throws(() => parseGoogleServiceAccountJson("invalid json"));
  });

  it("merges imported Google credentials and selects Service Account auth", () => {
    assert.deepEqual(
      mergeGoogleServiceAccountConfig(
        { api_key: "existing-key", url: "https://existing.example.com" },
        { client_email: "service-account@example.com", project_id: "project-id" },
      ),
      {
        api_key: "existing-key",
        url: "https://existing.example.com",
        client_email: "service-account@example.com",
        project_id: "project-id",
        auth_type: providerAuthType.serviceAccount,
      },
    );
  });

  it("validates Google Service Account client email values", () => {
    assert.equal(isValidProviderEmail(" service-account@example.com "), true);
    assert.equal(isValidProviderEmail("service-account@example"), false);
    assert.equal(isValidProviderEmail("invalid-email"), false);
  });
});
