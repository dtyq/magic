import { z } from "zod";

import { hasCommonRuntimeFields } from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config";
import {
  reasoningEffortLevels,
  type ReasoningEffort,
  providerModelCategory,
  providerModelType,
  type ProviderModelBillingTier,
  type ProviderModelCategory,
  type ProviderModelLegacyPricingConfig,
  type ProviderModelPricingEntry,
  type ProviderModelPricingTemplate,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";

export type ModelEditorValues = {
  model_id: string;
  name: string;
  name_en: string;
  icon: string;
  description: string;
  description_en: string;
  category: ProviderModelCategory;
  model_type: ProviderModelType;
  max_tokens: string;
  max_output_tokens: string;
  vector_size: string;
  temperature_mode: "recommended" | "fixed";
  temperature: string;
  chat_api: "chat_completions" | "responses";
  support_function: boolean;
  support_multi_modal: boolean;
  support_deep_think: boolean;
  reasoning_effort_levels: ReasoningEffort[];
  reasoning_effort_default: ReasoningEffort | null;
  providers: ProviderBindingValues[];
};

export type ProviderBindingValues = {
  client_key: string;
  record_id?: string;
  provider_code: string;
  service_provider_config_id: string;
  model_version: string;
  enabled: boolean;
  billing_currency: "CNY" | "USD";
  billing_type: string;
  pricing_template: ProviderModelPricingTemplate | null;
  pricing_entries: Record<string, ProviderModelPricingEntry>;
  billing_tiers: ProviderModelBillingTier[];
  legacy_pricing: ProviderModelLegacyPricingConfig;
  load_balancing_weight: string;
  extra_header: string;
  extra_body: string;
  visible_organizations?: string[];
  visible_applications?: string[];
  visible_packages?: string[];
};

export type ProviderBindingErrors = Partial<
  Record<keyof ProviderBindingValues, { message?: string }>
>;

const numberOrEmpty = z
  .string()
  .trim()
  .refine(
    (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "请输入不小于 0 的数字。",
  );

const integerOrEmpty = numberOrEmpty.refine(
  (value) => !value || Number.isInteger(Number(value)),
  "请输入整数。",
);

const temperatureOrEmpty = z
  .string()
  .trim()
  .refine(
    (value) =>
      !value || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 2),
    "温度必须在 0 到 2 之间。",
  );

const pricingTemplateSchema = z.object({
  code: z.string(),
  label: z.string(),
  category: z.string(),
  billing_type: z.string(),
  items: z.array(z.object({ billing_object: z.string(), label: z.string() })),
});

const legacyPricingSchema = z.object({
  input_pricing: z.number().nullable().optional(),
  output_pricing: z.number().nullable().optional(),
  cache_write_pricing: z.number().nullable().optional(),
  cache_hit_pricing: z.number().nullable().optional(),
  input_cost: z.number().nullable().optional(),
  output_cost: z.number().nullable().optional(),
  cache_write_cost: z.number().nullable().optional(),
  cache_hit_cost: z.number().nullable().optional(),
  time_pricing: z.number().nullable().optional(),
  time_cost: z.number().nullable().optional(),
  second_pricing: z.number().nullable().optional(),
  second_cost: z.number().nullable().optional(),
});

const bindingSchema = z.object({
  client_key: z.string(),
  record_id: z.string().optional(),
  provider_code: z.string(),
  service_provider_config_id: z.string().min(1, "请选择服务商。"),
  model_version: z.string().trim().min(1, "请输入部署名称。"),
  enabled: z.boolean(),
  billing_currency: z.enum(["CNY", "USD"]),
  billing_type: z.string(),
  pricing_template: pricingTemplateSchema.nullable(),
  pricing_entries: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      mode: z.enum([
        "fixed",
        "ladder",
        "input_token",
        "output_token",
        "cache_write_token",
        "cache_hit_token",
      ]),
      value: z.string(),
      steps: z.array(z.object({ max: z.string(), price: z.string() })),
    }),
  ),
  billing_tiers: z.array(
    z.object({
      billing_object: z.string(),
      follow_object: z.string(),
      pricing_mode: z.enum(["fixed", "tiered"]),
      pricing_rules: z.array(
        z.object({
          min: z.number().nullable(),
          max: z.number().nullable(),
          price: z.number(),
        }),
      ),
    }),
  ),
  legacy_pricing: legacyPricingSchema,
  load_balancing_weight: numberOrEmpty.refine(
    (value) => !value || Number(value) <= 100,
    "负载权重不能大于 100。",
  ),
  extra_header: z.string(),
  extra_body: z.string(),
  visible_organizations: z.array(z.string()).optional(),
  visible_applications: z.array(z.string()).optional(),
  visible_packages: z.array(z.string()).optional(),
});

export function createModelEditorSchema(isOfficialOrganization: boolean) {
  return z
    .object({
      model_id: z.string().trim().min(1, "请输入模型标识。"),
      name: z
        .string()
        .trim()
        .min(1, "请输入模型展示名称。")
        .max(50, "模型展示名称不能超过 50 个字符。"),
      name_en: z.string().trim().max(50, "英文展示名称不能超过 50 个字符。"),
      icon: z.string().trim(),
      description: z.string().trim(),
      description_en: z.string().trim(),
      category: z.enum([
        providerModelCategory.llm,
        providerModelCategory.embedding,
        providerModelCategory.vlm,
        providerModelCategory.vgm,
      ]),
      model_type: z.union([
        z.literal(providerModelType.textToImage),
        z.literal(providerModelType.imageToImage),
        z.literal(providerModelType.imageEnhancement),
        z.literal(providerModelType.largeLanguageModel),
        z.literal(providerModelType.embedding),
        z.literal(providerModelType.textToVideo),
      ]),
      max_tokens: integerOrEmpty,
      max_output_tokens: integerOrEmpty,
      vector_size: integerOrEmpty,
      temperature_mode: z.enum(["recommended", "fixed"]),
      temperature: temperatureOrEmpty,
      chat_api: z.enum(["chat_completions", "responses"]),
      support_function: z.boolean(),
      support_multi_modal: z.boolean(),
      support_deep_think: z.boolean(),
      reasoning_effort_levels: z.array(z.enum(reasoningEffortLevels)),
      reasoning_effort_default: z.enum(reasoningEffortLevels).nullable(),
      providers: z.array(bindingSchema).min(1, "至少添加一个服务商配置。"),
    })
    .superRefine((values, context) => {
      // 默认档位必须来自已开放的档位；关闭能力时仍保留合法的原配置。
      if (
        values.reasoning_effort_default !== null &&
        !values.reasoning_effort_levels.includes(values.reasoning_effort_default)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "modelList.editor.reasoning.invalidDefault",
          path: ["reasoning_effort_default"],
        });
      }
      // Legacy Admin only made these two fields required for the official organization.
      // max_tokens was always optional, including for regular LLM models.
      if (isOfficialOrganization && hasCommonRuntimeFields(values.model_type)) {
        if (!values.max_output_tokens.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "请输入最大输出 Tokens。",
            path: ["max_output_tokens"],
          });
        }

        if (!values.temperature.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "请输入温度。",
            path: ["temperature"],
          });
        }
      }

      const bindingIndexByIdentity = new Map<string, number>();

      values.providers.forEach((binding, index) => {
        const providerId = binding.service_provider_config_id.trim();
        const deploymentName = binding.model_version.trim();

        if (!providerId || !deploymentName) {
          return;
        }

        const identity = `${providerId}:${deploymentName}`;
        if (bindingIndexByIdentity.has(identity)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "同一服务商下的模型部署名称不能重复。",
            path: ["providers", index, "model_version"],
          });
          return;
        }

        bindingIndexByIdentity.set(identity, index);
      });
    });
}

// Keep a default schema export for pure utility callers and existing tests. The dialog
// uses the organization-aware factory so official-only required rules are not global.
export const modelEditorSchema = createModelEditorSchema(false);
