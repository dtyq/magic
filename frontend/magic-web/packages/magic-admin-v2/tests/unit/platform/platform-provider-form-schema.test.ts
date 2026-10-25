import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProviderConfigFields } from "../../../src/features/platform-provider-list/utils/provider-config.ts";
import {
  createAddProviderFormSchema,
  createProviderFormSchema,
} from "../../../src/features/platform-provider-list/utils/provider-form-schema.ts";
import {
  providerAuthType,
  providerCategory,
  providerType,
  type ProviderFormValues,
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

function createFormValues(config: ProviderFormValues["config"]): ProviderFormValues {
  return {
    service_provider_id: "provider-template-id",
    alias: "",
    alias_en: "",
    sort: 0,
    status: true,
    config,
  };
}

function getIssuePaths(result: ReturnType<ReturnType<typeof createProviderFormSchema>["safeParse"]>) {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("platform provider form validation", () => {
  it("requires visible provider fields only while the provider is enabled", () => {
    const provider = createProvider(providerCategory.llm, "OpenAI");
    const schema = createProviderFormSchema(
      translate,
      getProviderConfigFields(provider, translate),
      provider,
    );

    assert.deepEqual(getIssuePaths(schema.safeParse(createFormValues({}))), [
      "config.api_key",
      "config.url",
    ]);
    assert.equal(
      schema.safeParse({ ...createFormValues({}), status: false }).success,
      true,
    );
  });

  it("validates a visible URL but ignores a stale hidden URL", () => {
    const openAI = createProvider(providerCategory.llm, "OpenAI");
    const openAISchema = createProviderFormSchema(
      translate,
      getProviderConfigFields(openAI, translate),
      openAI,
    );
    assert.equal(
      getIssuePaths(
        openAISchema.safeParse(
          createFormValues({ api_key: "key", url: "not-an-http-url" }),
        ),
      ).includes("config.url"),
      true,
    );

    const bedrock = createProvider(providerCategory.llm, "AWSBedrock");
    const bedrockSchema = createProviderFormSchema(
      translate,
      getProviderConfigFields(bedrock, translate),
      bedrock,
    );
    assert.equal(
      bedrockSchema.safeParse(
        createFormValues({
          ak: "access-key",
          sk: "secret-key",
          region: "us-east-1",
          url: "stale-hidden-url",
        }),
      ).success,
      true,
    );
  });

  it("validates Google Service Account fields and client email", () => {
    const provider = createProvider(providerCategory.llm, "Google");
    const schema = createProviderFormSchema(
      translate,
      getProviderConfigFields(provider, translate),
      provider,
    );
    const config = {
      auth_type: providerAuthType.serviceAccount,
      project_id: "project-id",
      private_key_id: "private-key-id",
      private_key: "private-key",
      client_email: "invalid-email",
      client_id: "client-id",
    };

    assert.equal(
      getIssuePaths(schema.safeParse(createFormValues(config))).includes("config.client_email"),
      true,
    );
    assert.equal(
      schema.safeParse(
        createFormValues({ ...config, client_email: "service-account@example.com" }),
      ).success,
      true,
    );
  });

  it("requires a proxy server when enterprise proxy access is enabled", () => {
    const provider = createProvider(providerCategory.llm, "OpenAI");
    const schema = createProviderFormSchema(
      translate,
      getProviderConfigFields(provider, translate),
      provider,
      { requireProxyServer: true },
    );
    const config = {
      api_key: "key",
      url: "https://api.openai.com/v1",
      use_proxy: true,
    };

    assert.equal(
      getIssuePaths(schema.safeParse(createFormValues(config))).includes("config.proxy_server"),
      true,
    );
    assert.equal(
      getIssuePaths(
        schema.safeParse({ ...createFormValues(config), status: false }),
      ).includes("config.proxy_server"),
      true,
    );
    assert.equal(
      schema.safeParse(
        createFormValues({
          ...config,
          proxy_server: { id: "proxy-1", name: "Main Proxy" },
        }),
      ).success,
      true,
    );
  });

  it("does not require a proxy server when proxy access is off or unsupported", () => {
    const provider = createProvider(providerCategory.llm, "OpenAI");
    const fields = getProviderConfigFields(provider, translate);
    const validConfig = {
      api_key: "key",
      url: "https://api.openai.com/v1",
    };

    assert.equal(
      createProviderFormSchema(translate, fields, provider, {
        requireProxyServer: true,
      }).safeParse(createFormValues({ ...validConfig, use_proxy: false })).success,
      true,
    );
    assert.equal(
      createProviderFormSchema(translate, fields, provider).safeParse(
        createFormValues({ ...validConfig, use_proxy: true }),
      ).success,
      true,
    );
  });

  it("requires a provider template when adding a provider", () => {
    const provider = createProvider(providerCategory.llm, "OpenAI");
    const schema = createAddProviderFormSchema(
      translate,
      getProviderConfigFields(provider, translate),
      provider,
    );
    const result = schema.safeParse({
      ...createFormValues({ api_key: "key", url: "https://api.openai.com/v1" }),
      service_provider_id: "",
    });

    assert.equal(getIssuePaths(result).includes("service_provider_id"), true);
  });
});
