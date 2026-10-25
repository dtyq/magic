/** 统一思考档位与显示顺序，与模型网关协议保持一致。 */
export const reasoningEffortLevels = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type ReasoningEffort = (typeof reasoningEffortLevels)[number];

export const providerModelCategory = {
  llm: "llm",
  vlm: "vlm",
  vgm: "vgm",
  embedding: "embedding",
} as const;

export const providerModelType = {
  textToImage: 0,
  imageToImage: 1,
  imageEnhancement: 2,
  largeLanguageModel: 3,
  embedding: 4,
  textToVideo: 5,
} as const;

export const providerModelStatus = {
  disabled: 0,
  enabled: 1,
} as const;

export const providerOriginalModelIdType = {
  official: 0,
  nonOfficial: 1,
} as const;

/** 模型列表支持的 URL 查询参数。 */
export const providerModelListSearchParam = {
  serviceProviderConfigId: "service_provider_config_id",
} as const;

export type ProviderModelCategory =
  (typeof providerModelCategory)[keyof typeof providerModelCategory];
export type ProviderModelType = (typeof providerModelType)[keyof typeof providerModelType];
export type ProviderModelStatus = (typeof providerModelStatus)[keyof typeof providerModelStatus];

export type ProviderModelConnectivityTestByConfigPayload = {
  service_provider_config_id: string;
  model_version: string;
  category: ProviderModelCategory;
  model_type: ProviderModelType;
};

export type ProviderModelConnectivityTestResult = {
  status: boolean | number;
  message?: unknown;
};

export type ProviderOriginalModelId = {
  id: string;
  model_id: string;
  type: number;
  created_at?: string;
  updated_at?: string;
};

export type ProviderModelGroupQueryParams = {
  keyword: string;
  categories: ProviderModelCategory[];
  model_types: ProviderModelType[];
  statuses: ProviderModelStatus[];
  /** 按服务商配置 ID 筛选；URL 的单值参数会在页面中转换为数组。 */
  service_provider_config_ids?: string[];
  page: number;
  page_size: number;
};

export type ProviderModelProvider = {
  service_provider_config_id: string;
  provider_code: string;
  name: string;
  alias: string;
  status: ProviderModelStatus;
  icon?: string;
  model_record_id: string;
  model_status: ProviderModelStatus;
};

export type ProviderModelGroup = {
  model_id: string;
  name: string;
  category: ProviderModelCategory;
  model_type: ProviderModelType;
  icon?: string;
  provider_count: number;
  providers: ProviderModelProvider[];
};

export type ProviderModelGroupPage = {
  page: number;
  page_size: number;
  total: number;
  list: ProviderModelGroup[];
};

export type ProviderModelQueryParams = ProviderModelGroupQueryParams & {
  model_id?: string;
  provider_codes?: string[];
};

export type ProviderModelBillingCurrency = "CNY" | "USD";

export type ProviderModelPricingTemplateItem = {
  billing_object: string;
  label: string;
};

export type ProviderModelPricingTemplate = {
  code: string;
  label: string;
  category: string;
  billing_type: string;
  items: ProviderModelPricingTemplateItem[];
};

export type ProviderModelPricingRule = {
  min: number | null;
  max: number | null;
  price: number;
};

export type ProviderModelPricingMode =
  "fixed" | "ladder" | "input_token" | "output_token" | "cache_write_token" | "cache_hit_token";

export type ProviderModelPricingStep = {
  max: string;
  price: string;
};

export type ProviderModelPricingEntry = {
  enabled: boolean;
  mode: ProviderModelPricingMode;
  value: string;
  steps: ProviderModelPricingStep[];
};

export type ProviderModelBillingTier = {
  billing_object: string;
  follow_object: string;
  pricing_mode: "fixed" | "tiered";
  pricing_rules: ProviderModelPricingRule[];
};

/** 历史模型配置中的扁平定价字段，仅用于兼容读取和迁移。 */
export type ProviderModelLegacyPricingConfig = {
  input_pricing?: number | null;
  output_pricing?: number | null;
  cache_write_pricing?: number | null;
  cache_hit_pricing?: number | null;
  input_cost?: number | null;
  output_cost?: number | null;
  cache_write_cost?: number | null;
  cache_hit_cost?: number | null;
  time_pricing?: number | null;
  time_cost?: number | null;
  second_pricing?: number | null;
  second_cost?: number | null;
};

export type ProviderModelConfig = {
  max_tokens?: number;
  max_output_tokens?: number;
  vector_size?: number;
  creativity?: number | null;
  temperature?: number | null;
  chat_api?: "chat_completions" | "responses";
  support_function?: boolean;
  support_multi_modal?: boolean;
  support_deep_think?: boolean;
  reasoning_effort_levels?: ReasoningEffort[] | null;
  /** 空值表示跟随服务商默认，前端仅配置并保存该字段。 */
  reasoning_effort_default?: ReasoningEffort | null;
  billing_currency: ProviderModelBillingCurrency;
  billing_type: string;
  billing_tiers?: ProviderModelBillingTier[] | null;
  input_pricing?: number | null;
  output_pricing?: number | null;
  cache_write_pricing?: number | null;
  cache_hit_pricing?: number | null;
  input_cost?: number | null;
  output_cost?: number | null;
  cache_write_cost?: number | null;
  cache_hit_cost?: number | null;
  time_pricing?: number | null;
  time_cost?: number | null;
  second_pricing?: number | null;
  second_cost?: number | null;
};

export type ProviderModelExtra = {
  extra_header?: string;
  extra_body?: string;
};

export type CreateProviderModelPayload = {
  model_id: string;
  name: string;
  icon?: string;
  description?: string;
  /** 旧版模型编辑会原样携带这些可见范围字段，更新时不能丢失。 */
  visible_organizations?: string[];
  visible_applications?: string[];
  visible_packages?: string[];
  category: ProviderModelCategory;
  model_type: ProviderModelType;
  service_provider_config_id: string;
  model_version: string;
  config: ProviderModelConfig;
  extra?: ProviderModelExtra;
  load_balancing_weight?: number;
  translate?: {
    name?: Record<string, string | undefined>;
    description?: Record<string, string | undefined>;
  };
};

export type SaveProviderModelPayload = CreateProviderModelPayload & {
  id?: string;
};

export type ProviderModelRecord = CreateProviderModelPayload & {
  /** 接口始终返回完整思考配置，历史空值兼容由后端负责。 */
  config: ProviderModelConfig & {
    reasoning_effort_levels: ReasoningEffort[];
    reasoning_effort_default: ReasoningEffort | null;
  };
  id: string;
  status: ProviderModelStatus;
  provider_code?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProviderModelSaveInput = {
  bindingKey: string;
  payload: CreateProviderModelPayload;
  desiredStatus: ProviderModelStatus;
  existingRecordId?: string;
};

export type ProviderModelSaveResult = {
  bindingKey: string;
  recordId?: string;
  status: "success" | "failed";
  errorMessage?: string;
  retryInput?: ProviderModelSaveInput;
};
