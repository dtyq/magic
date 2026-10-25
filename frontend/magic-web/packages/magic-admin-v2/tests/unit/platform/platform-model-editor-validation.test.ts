import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  providerModelStatus,
  providerModelType,
  type ProviderModelRecord,
} from "@magic-admin-v2/features/platform-model-list/types";
import {
  createModelEditorSchema,
  modelEditorSchema,
  type ModelEditorValues,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema";
import {
  createEditorValues,
  createEmptyValues,
  toSaveInputs,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor";

function createValues(overrides: Partial<ModelEditorValues> = {}): ModelEditorValues {
  return {
    model_id: "gpt-test",
    name: "测试模型",
    name_en: "Test model",
    icon: "",
    description: "",
    description_en: "",
    category: "llm",
    model_type: providerModelType.largeLanguageModel,
    max_tokens: "128000",
    max_output_tokens: "4096",
    vector_size: "",
    temperature_mode: "recommended",
    temperature: "0.7",
    chat_api: "chat_completions",
    support_function: true,
    support_multi_modal: true,
    support_deep_think: false,
    reasoning_effort_levels: ["low", "medium", "high"],
    reasoning_effort_default: null,
    providers: [
      {
        client_key: "binding-1",
        provider_code: "openai",
        service_provider_config_id: "provider-1",
        model_version: "gpt-test",
        enabled: true,
        billing_currency: "CNY",
        billing_type: "token",
        pricing_template: null,
        pricing_entries: {},
        billing_tiers: [],
        legacy_pricing: {},
        load_balancing_weight: "",
        extra_header: "",
        extra_body: "",
      },
    ],
    ...overrides,
  };
}

describe("platform model editor validation", () => {
  it("keeps maximum context tokens optional for regular organizations", () => {
    const result = modelEditorSchema.safeParse(createValues({ max_tokens: "" }));

    assert.equal(result.success, true);
  });

  it("requires official-only runtime values for the official organization", () => {
    const result = createModelEditorSchema(true).safeParse(
      createValues({ max_output_tokens: "", temperature: "" }),
    );

    assert.equal(result.success, false);
    if (result.success) return;

    assert.deepEqual(
      result.error.issues
        .filter((issue) => issue.path.length === 1)
        .map((issue) => issue.path[0])
        .sort(),
      ["max_output_tokens", "temperature"],
    );
  });

  it("preserves visibility scopes through schema parsing", () => {
    const values = createValues({
      providers: [
        {
          ...createValues().providers[0],
          visible_organizations: ["org-1"],
          visible_applications: ["app-1"],
          visible_packages: ["package-1"],
        },
      ],
    });

    const result = modelEditorSchema.safeParse(values);

    assert.equal(result.success, true);
    if (!result.success) return;

    assert.deepEqual(result.data.providers[0].visible_organizations, ["org-1"]);
    assert.deepEqual(result.data.providers[0].visible_applications, ["app-1"]);
    assert.deepEqual(result.data.providers[0].visible_packages, ["package-1"]);
  });

  it("keeps legacy runtime number constraints", () => {
    const fractionalTokenResult = modelEditorSchema.safeParse(
      createValues({ max_tokens: "128000.5" }),
    );
    assert.equal(fractionalTokenResult.success, false);

    const outOfRangeTemperatureResult = modelEditorSchema.safeParse(
      createValues({ temperature: "2.1" }),
    );
    assert.equal(outOfRangeTemperatureResult.success, false);
  });

  it("does not require maximum context tokens for embedding, image, or video models", () => {
    [
      providerModelType.embedding,
      providerModelType.textToImage,
      providerModelType.textToVideo,
    ].forEach((model_type) => {
      const result = modelEditorSchema.safeParse(
        createValues({
          model_type,
          max_tokens: "",
        }),
      );

      assert.equal(result.success, true, `model type ${model_type} should not require max_tokens`);
    });
  });
});

describe("extra request configuration", () => {
  it("persists extra headers and bodies for Embedding model types", () => {
    const values = createValues({
      category: "llm",
      model_type: providerModelType.embedding,
      max_tokens: "",
      providers: [
        {
          ...createValues().providers[0],
          extra_header: '{"x-api-key":"test"}',
          extra_body: '{"encoding_format":"float"}',
        },
      ],
    });

    const [input] = toSaveInputs(values, true, true);

    assert.deepEqual(input.payload.extra, {
      extra_header: '{"x-api-key":"test"}',
      extra_body: '{"encoding_format":"float"}',
    });
  });
});

describe("official synchronized model bindings", () => {
  it("preserves the synchronized record and only changes load balancing weight", () => {
    const record: ProviderModelRecord = {
      id: "record-official",
      status: providerModelStatus.enabled,
      model_id: "gpt-test",
      name: "",
      icon: "",
      description: "",
      category: "llm",
      model_type: providerModelType.largeLanguageModel,
      service_provider_config_id: "provider-official",
      model_version: "deployment",
      provider_code: "official",
      config: {
        reasoning_effort_levels: ["low", "medium", "high"],
        reasoning_effort_default: null,
        billing_currency: "CNY",
        billing_type: "TextTokens",
        max_tokens: 128000,
      },
      extra: { extra_header: "{}", extra_body: "{}" },
      translate: { name: { en_US: "GPT" } },
      visible_organizations: [],
      visible_applications: [],
      visible_packages: [],
      load_balancing_weight: 10,
    };
    const values = createValues({
      providers: [
        {
          ...createValues().providers[0],
          client_key: "binding-official",
          record_id: record.id,
          service_provider_config_id: record.service_provider_config_id,
          load_balancing_weight: "42",
        },
      ],
    });

    const [input] = toSaveInputs(values, true, true, {}, { [record.id]: record });

    assert.equal(input.existingRecordId, record.id);
    assert.equal(input.desiredStatus, providerModelStatus.enabled);
    assert.equal(input.payload.load_balancing_weight, 42);
    assert.equal(input.payload.icon, "");
    assert.deepEqual(input.payload.extra, record.extra);
    assert.deepEqual(input.payload.translate, record.translate);
    assert.deepEqual(input.payload.visible_organizations, []);
    assert.equal("id" in input.payload, false);
    assert.equal("status" in input.payload, false);
    assert.equal("provider_code" in input.payload, false);
  });

  it("does not treat an ordinary provider record id as synchronized", () => {
    const values = createValues({
      providers: [{ ...createValues().providers[0], record_id: "record-ordinary" }],
    });
    const [input] = toSaveInputs(values, true, true);

    assert.equal(input.existingRecordId, "record-ordinary");
    assert.equal(input.payload.model_id, values.model_id);
  });
});

describe("思考档位配置", () => {
  it("新建初始化三档，已有模型直接回显后端档位与显式空数组", () => {
    assert.deepEqual(createEmptyValues().reasoning_effort_levels, ["low", "medium", "high"]);
    const record: ProviderModelRecord = {
      id: "mock-record",
      status: providerModelStatus.enabled,
      model_id: "mock-model",
      name: "Mock",
      icon: "",
      description: "",
      category: "llm",
      model_type: providerModelType.largeLanguageModel,
      service_provider_config_id: "mock-provider",
      model_version: "mock-version",
      config: {
        reasoning_effort_levels: ["low", "medium", "high"],
        reasoning_effort_default: null,
        billing_currency: "CNY",
        billing_type: "TextTokens",
        support_deep_think: true,
      },
    };
    assert.deepEqual(createEditorValues([record]).reasoning_effort_levels, [
      "low",
      "medium",
      "high",
    ]);
    assert.deepEqual(
      createEditorValues([{ ...record, config: { ...record.config, reasoning_effort_levels: [] } }])
        .reasoning_effort_levels,
      [],
    );
  });

  it("关闭后保存仍保留已配置档位，非法档位无法通过表单校验", () => {
    const values = createValues({
      support_deep_think: false,
      reasoning_effort_levels: ["none", "high"],
    });
    const [input] = toSaveInputs(values, true, true);
    assert.deepEqual(input.payload.config.reasoning_effort_levels, ["none", "high"]);
    assert.equal(
      modelEditorSchema.safeParse({ ...values, reasoning_effort_levels: ["unknown"] }).success,
      false,
    );
  });
});

describe("默认思考强度配置", () => {
  it("新建默认跟随服务商，默认和明确关闭分开保存", () => {
    assert.equal(createEmptyValues().reasoning_effort_default, null);
    const [follow] = toSaveInputs(createValues(), true, true);
    assert.equal(follow.payload.config.reasoning_effort_default, null);
    const values = createValues({
      support_deep_think: true,
      reasoning_effort_levels: ["none", "high"],
      reasoning_effort_default: "none",
    });
    assert.equal(modelEditorSchema.safeParse(values).success, true);
    const [off] = toSaveInputs(values, true, true);
    assert.equal(off.payload.config.reasoning_effort_default, "none");
  });

  it("默认值只能从可选档位中选择，关闭能力仍保留合法默认", () => {
    assert.equal(
      modelEditorSchema.safeParse(createValues({ reasoning_effort_default: "max" })).success,
      false,
    );
    const values = createValues({ support_deep_think: false, reasoning_effort_default: "high" });
    assert.equal(modelEditorSchema.safeParse(values).success, true);
    const [input] = toSaveInputs(values, true, true);
    assert.equal(input.payload.config.reasoning_effort_default, "high");
  });

  it("详情直接回显后端归一化的默认配置", () => {
    const record: ProviderModelRecord = {
      id: "mock-default-record",
      status: providerModelStatus.enabled,
      model_id: "mock-default-model",
      name: "Mock",
      icon: "",
      description: "",
      category: "llm",
      model_type: providerModelType.largeLanguageModel,
      service_provider_config_id: "mock-provider",
      model_version: "mock-version",
      config: {
        reasoning_effort_levels: ["low", "medium", "high"],
        reasoning_effort_default: "high",
        billing_currency: "CNY",
        billing_type: "TextTokens",
        support_deep_think: true,
      },
    };
    assert.equal(createEditorValues([record]).reasoning_effort_default, "high");
    assert.equal(
      createEditorValues([
        {
          ...record,
          config: {
            ...record.config,
            reasoning_effort_levels: ["low"],
            reasoning_effort_default: null,
          },
        },
      ]).reasoning_effort_default,
      null,
    );
  });
});
