import {
  getCommonRuntimeFieldVisibility,
  isEmbeddingModelType,
} from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config";
import {
  providerModelCategory,
  providerModelStatus,
  providerModelType,
  type CreateProviderModelPayload,
  type ProviderModelBillingTier,
  type ProviderModelCategory,
  type ProviderModelRecord,
  type ProviderModelSaveInput,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";
import type {
  ModelEditorValues,
  ProviderBindingValues,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema";
import { extractLegacyPricingConfig } from "@magic-admin-v2/features/platform-model-list/utils/pricing";
import {
  providerCategory,
  type ProviderCategory,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function createBindingValues(): ProviderBindingValues {
  return {
    client_key: `binding-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    provider_code: "",
    service_provider_config_id: "",
    model_version: "",
    enabled: true,
    billing_currency: "CNY",
    billing_type: "",
    pricing_template: null,
    pricing_entries: {},
    billing_tiers: [],
    legacy_pricing: {},
    load_balancing_weight: "",
    extra_header: "",
    extra_body: "",
  };
}

function stringifyNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function compareProviderModelRecordIds(leftId: string, rightId: string) {
  const hasNumericIds = /^\d+$/.test(leftId) && /^\d+$/.test(rightId);
  if (hasNumericIds && leftId.length !== rightId.length) {
    return leftId.length - rightId.length;
  }

  return leftId.localeCompare(rightId);
}

export function createEditorValues(records: ProviderModelRecord[]): ModelEditorValues {
  const representativeRecord = records.reduce<ProviderModelRecord | null>(
    (current, record) =>
      current === null || compareProviderModelRecordIds(record.id, current.id) < 0
        ? record
        : current,
    null,
  );
  if (!representativeRecord) {
    return createEmptyValues();
  }

  const config = representativeRecord.config;
  const fixedTemperature = config.temperature;
  const recommendedTemperature = config.creativity;
  const temperatureMode =
    fixedTemperature !== null && fixedTemperature !== undefined ? "fixed" : "recommended";
  const temperature = temperatureMode === "fixed" ? fixedTemperature : recommendedTemperature;

  return {
    model_id: representativeRecord.model_id,
    name: representativeRecord.translate?.name?.zh_CN ?? representativeRecord.name,
    name_en: representativeRecord.translate?.name?.en_US ?? "",
    icon: representativeRecord.icon ?? "",
    description:
      representativeRecord.translate?.description?.zh_CN ?? representativeRecord.description ?? "",
    description_en: representativeRecord.translate?.description?.en_US ?? "",
    category:
      representativeRecord.model_type === providerModelType.embedding
        ? providerModelCategory.llm
        : representativeRecord.category,
    model_type: representativeRecord.model_type,
    max_tokens: stringifyNumber(config.max_tokens),
    max_output_tokens: stringifyNumber(config.max_output_tokens),
    vector_size: stringifyNumber(config.vector_size),
    temperature_mode: temperatureMode,
    temperature: stringifyNumber(temperature),
    chat_api: config.chat_api ?? "chat_completions",
    support_function: Boolean(config.support_function),
    support_multi_modal: Boolean(config.support_multi_modal),
    support_deep_think: Boolean(config.support_deep_think),
    // 历史配置由后端补齐，编辑器直接回显接口配置。
    reasoning_effort_levels: config.reasoning_effort_levels,
    reasoning_effort_default: config.reasoning_effort_default,
    providers: records.map((record) => ({
      client_key: record.id,
      record_id: record.id,
      provider_code: record.provider_code ?? "",
      service_provider_config_id: record.service_provider_config_id,
      model_version: record.model_version,
      enabled: record.status === providerModelStatus.enabled,
      billing_currency: record.config.billing_currency ?? "CNY",
      billing_type: record.config.billing_type || getDefaultBillingType(record.category),
      pricing_template: null,
      pricing_entries: {},
      billing_tiers: record.config.billing_tiers ?? [],
      legacy_pricing: extractLegacyPricingConfig(record.config),
      load_balancing_weight: stringifyNumber(record.load_balancing_weight),
      extra_header: record.extra?.extra_header ?? "",
      extra_body: record.extra?.extra_body ?? "",
      visible_organizations: record.visible_organizations,
      visible_applications: record.visible_applications,
      visible_packages: record.visible_packages,
    })),
  };
}

/**
 * Build a new editor draft from an existing model configuration.
 * Imported provider records must be created as new records, rather than treated
 * as updates to the source configuration.
 */
export function createImportedEditorValues(record: ProviderModelRecord): ModelEditorValues {
  const values = createEditorValues([record]);

  return {
    ...values,
    providers: values.providers.map((binding) => ({
      ...binding,
      client_key: createBindingValues().client_key,
      record_id: undefined,
    })),
  };
}

export type ModelLanguageValues = Pick<
  ModelEditorValues,
  "name" | "name_en" | "description" | "description_en"
>;

export function getUnpairedLanguageChanges(
  initial: ModelLanguageValues,
  current: ModelLanguageValues,
) {
  const nameChanged = initial.name.trim() !== current.name.trim();
  const nameEnChanged = initial.name_en.trim() !== current.name_en.trim();
  const descriptionChanged = initial.description.trim() !== current.description.trim();
  const descriptionEnChanged = initial.description_en.trim() !== current.description_en.trim();

  return {
    name: nameChanged !== nameEnChanged,
    description: descriptionChanged !== descriptionEnChanged,
  };
}

export function createEmptyValues(
  initialCategory: ProviderModelCategory = providerModelCategory.llm,
  initialModelType: ProviderModelType = providerModelType.largeLanguageModel,
): ModelEditorValues {
  return {
    model_id: "",
    name: "",
    name_en: "",
    icon: "",
    description: "",
    description_en: "",
    category: initialCategory,
    model_type: initialModelType,
    max_tokens: "128000",
    max_output_tokens: "64000",
    vector_size: "0",
    temperature_mode: "recommended",
    temperature: "0.7",
    chat_api: "chat_completions",
    support_function: true,
    support_multi_modal: true,
    support_deep_think: false,
    reasoning_effort_levels: ["low", "medium", "high"],
    reasoning_effort_default: null,
    providers: [createBindingValues()],
  };
}

function toOptionalNumber(value: string) {
  const normalized = value.trim();
  return normalized ? Number(normalized) : undefined;
}

export function getProviderCategory(category: ProviderModelCategory): ProviderCategory {
  if (category === providerModelCategory.embedding) {
    return providerCategory.llm;
  }

  return category;
}

export function getDefaultBillingType(category: ProviderModelCategory) {
  switch (category) {
    case providerModelCategory.vlm:
      return "ImageTokens";
    case providerModelCategory.vgm:
      return "VideoResolutionDuration";
    default:
      return "TextTokens";
  }
}

export function getModelTypeOptions(category: ProviderModelCategory, t: (key: string) => string) {
  const options: Record<
    ProviderModelCategory,
    Array<{ label: string; value: ProviderModelType }>
  > = {
    [providerModelCategory.llm]: [
      {
        label: t("modelList.type.largeLanguageModel"),
        value: providerModelType.largeLanguageModel,
      },
      { label: t("modelList.type.embedding"), value: providerModelType.embedding },
    ],
    [providerModelCategory.embedding]: [
      { label: t("modelList.type.embedding"), value: providerModelType.embedding },
    ],
    [providerModelCategory.vlm]: [
      { label: t("modelList.type.textToImage"), value: providerModelType.textToImage },
      { label: t("modelList.type.imageToImage"), value: providerModelType.imageToImage },
      {
        label: t("modelList.type.imageEnhancement"),
        value: providerModelType.imageEnhancement,
      },
    ],
    [providerModelCategory.vgm]: [
      { label: t("modelList.type.textToVideo"), value: providerModelType.textToVideo },
    ],
  };

  return options[category];
}

export function getCategoryLabel(category: ProviderModelCategory, t: (key: string) => string) {
  const labels: Record<ProviderModelCategory, string> = {
    [providerModelCategory.llm]: "modelList.category.llm",
    [providerModelCategory.embedding]: "modelList.category.embedding",
    [providerModelCategory.vlm]: "modelList.category.vlm",
    [providerModelCategory.vgm]: "modelList.category.vgm",
  };

  return t(labels[category]);
}

export function getErrorMessage(message: unknown) {
  return typeof message === "string" ? message : undefined;
}

export function toSaveInputs(
  values: ModelEditorValues,
  supportsLoadBalancing: boolean,
  isOfficialOrganization: boolean,
  canonicalPricingTiers: Record<string, ProviderModelBillingTier[] | null> = {},
  officialSyncedRecords: Record<string, ProviderModelRecord> = {},
): ProviderModelSaveInput[] {
  return values.providers.map((binding) => {
    const officialSyncedRecord = binding.record_id
      ? officialSyncedRecords[binding.record_id]
      : undefined;
    if (officialSyncedRecord) {
      const loadBalancingWeight = supportsLoadBalancing
        ? toOptionalNumber(binding.load_balancing_weight)
        : undefined;

      const officialPayload = Object.fromEntries(
        Object.entries(officialSyncedRecord).filter(
          ([key]) => !["id", "status", "provider_code", "created_at", "updated_at"].includes(key),
        ),
      ) as CreateProviderModelPayload;

      return {
        bindingKey: binding.client_key,
        existingRecordId: officialSyncedRecord.id,
        desiredStatus: officialSyncedRecord.status,
        payload: {
          ...officialPayload,
          load_balancing_weight: loadBalancingWeight ?? officialSyncedRecord.load_balancing_weight,
        },
      };
    }

    const isEmbedding = isEmbeddingModelType(values.model_type);
    const runtimeVisibility = getCommonRuntimeFieldVisibility(
      values.model_type,
      isOfficialOrganization,
    );
    const supportsExtraRequest =
      values.category === providerModelCategory.llm || isEmbeddingModelType(values.model_type);
    const supportsChatApi = values.model_type === providerModelType.largeLanguageModel;
    const persistedCategory = isEmbedding ? providerModelCategory.llm : values.category;
    const hasCanonicalPricing = Object.prototype.hasOwnProperty.call(
      canonicalPricingTiers,
      binding.client_key,
    );
    const billingTiers = hasCanonicalPricing
      ? canonicalPricingTiers[binding.client_key]
      : binding.billing_tiers;
    const temperature = toOptionalNumber(values.temperature);
    const maxTokens = toOptionalNumber(values.max_tokens);
    const maxOutputTokens = toOptionalNumber(values.max_output_tokens);
    const vectorSize = toOptionalNumber(values.vector_size);
    const loadBalancingWeight = supportsLoadBalancing
      ? toOptionalNumber(binding.load_balancing_weight)
      : undefined;

    const config: CreateProviderModelPayload["config"] = {
      billing_currency: binding.billing_currency,
      billing_type: binding.billing_type || getDefaultBillingType(values.category),
      billing_tiers: billingTiers?.length ? billingTiers : null,
      ...(runtimeVisibility.vectorSize && vectorSize !== undefined
        ? { vector_size: vectorSize }
        : {}),
      ...(runtimeVisibility.maxTokens && maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(runtimeVisibility.maxOutputTokens && maxOutputTokens !== undefined
        ? { max_output_tokens: maxOutputTokens }
        : {}),
      ...(runtimeVisibility.capabilities
        ? {
            support_function: values.support_function,
            support_multi_modal: values.support_multi_modal,
            support_deep_think: values.support_deep_think,
            reasoning_effort_levels: values.reasoning_effort_levels,
            reasoning_effort_default: values.reasoning_effort_default,
          }
        : {}),
      ...(supportsChatApi ? { chat_api: values.chat_api } : {}),
      ...(runtimeVisibility.temperature
        ? {
            creativity: values.temperature_mode === "recommended" ? (temperature ?? null) : null,
            temperature: values.temperature_mode === "fixed" ? (temperature ?? null) : null,
          }
        : {}),
    };

    return {
      bindingKey: binding.client_key,
      ...(binding.record_id ? { existingRecordId: binding.record_id } : {}),
      desiredStatus: binding.enabled ? providerModelStatus.enabled : providerModelStatus.disabled,
      payload: {
        model_id: values.model_id.trim(),
        name: values.name.trim(),
        ...(values.icon.trim() ? { icon: values.icon.trim() } : {}),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(binding.visible_organizations
          ? { visible_organizations: binding.visible_organizations }
          : {}),
        ...(binding.visible_applications
          ? { visible_applications: binding.visible_applications }
          : {}),
        ...(binding.visible_packages ? { visible_packages: binding.visible_packages } : {}),
        category: persistedCategory,
        model_type: values.model_type,
        service_provider_config_id: binding.service_provider_config_id,
        model_version: binding.model_version.trim(),
        config,
        ...(supportsExtraRequest && (binding.extra_header.trim() || binding.extra_body.trim())
          ? {
              extra: {
                ...(binding.extra_header.trim()
                  ? { extra_header: binding.extra_header.trim() }
                  : {}),
                ...(binding.extra_body.trim() ? { extra_body: binding.extra_body.trim() } : {}),
              },
            }
          : {}),
        ...(loadBalancingWeight !== undefined
          ? { load_balancing_weight: loadBalancingWeight }
          : {}),
        translate: {
          name: {
            zh_CN: values.name.trim() || undefined,
            en_US: values.name_en.trim() || undefined,
          },
          description: {
            zh_CN: values.description.trim() || undefined,
            en_US: values.description_en.trim() || undefined,
          },
        },
      },
    };
  });
}
