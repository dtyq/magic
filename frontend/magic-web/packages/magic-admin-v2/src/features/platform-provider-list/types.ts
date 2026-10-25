export const providerStatus = {
  disabled: 0,
  enabled: 1,
} as const;

export const providerType = {
  nonOfficial: 0,
  official: 1,
  custom: 2,
} as const;

export const providerCategory = {
  llm: "llm",
  vlm: "vlm",
  vgm: "vgm",
} as const;

export const providerAuthType = {
  apiKey: "api_key",
  serviceAccount: "service_account",
} as const;

export const providerSelectAllValue = "all";

export type ProviderStatus = (typeof providerStatus)[keyof typeof providerStatus];
export type ProviderType = (typeof providerType)[keyof typeof providerType];
export type ProviderCategory = (typeof providerCategory)[keyof typeof providerCategory];
export type ProviderAuthType = (typeof providerAuthType)[keyof typeof providerAuthType];

export type ProviderLang = {
  zh_CN?: string;
  en_US?: string;
  vi_VN?: string;
  th_TH?: string;
  ms_MY?: string;
};

export type ProviderTranslate = {
  alias?: ProviderLang;
};

export type ProviderProxyServer = {
  id: string;
  name: string;
};

export type ProviderConfig = {
  ak?: string;
  api_key?: string;
  api_version?: string;
  auth_type?: ProviderAuthType;
  client_email?: string;
  client_id?: string;
  location?: string;
  private_key?: string;
  private_key_id?: string;
  project_id?: string;
  proxy_server?: ProviderProxyServer;
  region?: string;
  sk?: string;
  use_proxy?: boolean;
  url?: string;
  [key: string]: unknown;
};

export type ProviderTemplate = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  remark?: string;
  provider_code: string;
  provider_type: ProviderType;
  category: ProviderCategory;
  status?: ProviderStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProviderModelInfo = {
  id: string;
  model_id: string;
  name?: string;
  icon?: string;
  description?: string;
  category?: ProviderCategory;
  provider_code?: string;
  model_version?: string;
  model_type?: number;
  status?: ProviderStatus;
  created_at?: string;
};

export type ProviderListItem = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  alias?: string;
  translate?: ProviderTranslate;
  sort: number;
  status: ProviderStatus;
  service_provider_id: string;
  provider_code: string;
  provider_type: ProviderType;
  models?: ProviderModelInfo[];
  config?: ProviderConfig;
  is_models_enable?: boolean;
  category: ProviderCategory;
  created_at?: string;
};

export type AddProviderParams = {
  alias: string;
  service_provider_id: string;
  status: ProviderStatus;
  config?: ProviderConfig;
  translate?: ProviderTranslate;
};

export type UpdateProviderParams = {
  id: string;
  status: ProviderStatus;
  config: ProviderConfig;
  alias: string;
  sort: number;
  translate: ProviderTranslate;
  provider_code: string;
};

export type ProviderFormValues = {
  service_provider_id?: string;
  alias: string;
  alias_en: string;
  sort: number;
  status: boolean;
  config: ProviderConfig;
};
