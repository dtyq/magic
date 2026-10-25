import {
  providerAuthType,
  providerCategory,
  type ProviderCategory,
  type ProviderConfig,
  type ProviderListItem,
  type ProviderTemplate,
} from "@magic-admin-v2/features/platform-provider-list/types";

export type ProviderConfigField = {
  description?: string;
  inputType?: "email" | "text" | "password" | "textarea";
  key: keyof ProviderConfig & string;
  label: string;
  placeholder?: string;
  required?: boolean;
};

type ProviderIdentity = Pick<
  ProviderListItem | ProviderTemplate,
  "category" | "provider_code" | "name"
>;

type ProviderCategoryConfig = {
  /** 默认显示 API Key，此列表中的服务商除外。 */
  excludeApiKey: readonly string[];
  /** 默认显示 API 地址，此列表中的服务商除外。 */
  excludeApiUrl: readonly string[];
  /** 需要 API Version 的服务商。 */
  apiVersion: readonly string[];
  /** 需要 Access Key 的服务商。 */
  accessKey: readonly string[];
  /** 需要 Secret Key 的服务商。 */
  secretKey: readonly string[];
  /** 需要 Region 的服务商。 */
  region: readonly string[];
};

type ProviderConfigRule = {
  showApiKey: boolean;
  showApiUrl: boolean;
  showApiVersion: boolean;
  showAccessKey: boolean;
  showSecretKey: boolean;
  showRegion: boolean;
};

/**
 * 服务商配置字段必须同时按分类和服务商编码判断。
 * 同一个 provider_code 在不同模型分类下可能采用不同认证方式。
 */
const providerConfigByCategory: Record<ProviderCategory, ProviderCategoryConfig> = {
  [providerCategory.llm]: {
    excludeApiKey: ["AWSBedrock"],
    excludeApiUrl: ["AWSBedrock"],
    apiVersion: ["MicrosoftAzure", "Anthropic"],
    accessKey: ["AWSBedrock"],
    secretKey: ["AWSBedrock"],
    region: ["AWSBedrock"],
  },
  [providerCategory.vlm]: {
    excludeApiKey: ["MiracleVision", "Volcengine"],
    excludeApiUrl: ["MiracleVision", "Volcengine"],
    apiVersion: ["MicrosoftAzure"],
    accessKey: ["MiracleVision", "Volcengine"],
    secretKey: ["MiracleVision", "Volcengine"],
    region: [],
  },
  [providerCategory.vgm]: {
    excludeApiKey: [],
    excludeApiUrl: [],
    apiVersion: [],
    accessKey: [],
    secretKey: [],
    region: [],
  },
};

const serviceProviderUrls: Partial<Record<string, string>> = {
  OpenAI: "https://api.openai.com/v1",
  MicrosoftAzure: "https://docs-test-001.openai.azure.com",
  Volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  VolcengineArk: "https://ark.cn-beijing.volces.com/api/v3",
  Tencent: "https://api.hunyuan.cloud.tencent.com/v1",
  Qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  DashScope: "https://dashscope.aliyuncs.com/api/v1",
  QwenGlobal: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  DeepSeek: "https://api.deepseek.com",
  Baidu: "https://qianfan.baidubce.com/v2",
  SCNet: "https://api.scnet.cn/api/llm/v1",
  Moonshot: "https://api.moonshot.cn/v1",
  BigModel: "https://open.bigmodel.cn/api/paas/v4",
  MiniMax: "https://api.minimaxi.com/v1",
  SiliconFlow: "https://api.siliconflow.cn/v1",
  Gemini: "https://api.gemini.com",
  "Google-Image": "https://api.googleimage.com",
  OpenRouter: "https://openrouter.ai/api/v1/chat/completions",
  Google: "https://generativelanguage.googleapis.com/v1beta",
  Anthropic: "https://api.anthropic.com",
  Magic: "https://openapi.letsmagic.cn",
  magic: "https://openapi.letsmagic.cn",
  Keling: "https://api.klingai.com",
};

export const googleProviderCodes: ReadonlySet<string> = new Set([
  "Google-Image",
  "Gemini",
  "Google",
]);

const googleServiceAccountFields = new Set([
  "project_id",
  "private_key_id",
  "private_key",
  "client_email",
  "client_id",
  "location",
]);

export function getProviderConfigFields(
  provider: ProviderIdentity,
  t: (key: string) => string,
): ProviderConfigField[] {
  const code = provider.provider_code;
  const fields: ProviderConfigField[] = [];
  const isGoogle = googleProviderCodes.has(code);
  const rule = getProviderConfigRule(provider);
  const defaultUrl = getDefaultProviderUrl(provider);
  const apiKeyName =
    code === "MicrosoftAzure" ? "Azure" : code === "AWSBedrock" ? "AWS" : provider.name || "";
  const accessKeyName = code === "AWSBedrock" ? "AWS" : "";

  if (isGoogle) {
    fields.push(
      {
        key: "project_id",
        label: "Project ID",
        placeholder: "my-google-project",
        required: true,
      },
      {
        key: "private_key_id",
        inputType: "password",
        label: "Private Key ID",
        placeholder: "Private Key ID",
        required: true,
      },
      {
        key: "private_key",
        inputType: "textarea",
        label: "Private Key",
        placeholder: "-----BEGIN PRIVATE KEY-----",
        required: true,
      },
      {
        key: "client_email",
        inputType: "email",
        label: "Client Email",
        placeholder: "service-account@project.iam.gserviceaccount.com",
        required: true,
      },
      {
        key: "client_id",
        label: "Client ID",
        placeholder: "Client ID",
        required: true,
      },
      {
        key: "location",
        label: "Location",
        placeholder: "Global",
      },
    );
  }

  if (rule.showApiKey) {
    fields.push({
      key: "api_key",
      inputType: "password",
      label: `${apiKeyName} API Key`.trim(),
      placeholder: `${provider.name} API Key`,
      required: !isGoogle,
    });
  }

  if (rule.showAccessKey) {
    fields.push({
      key: "ak",
      inputType: "password",
      label: `${accessKeyName} Access Key`.trim(),
      placeholder: "AccessKey",
      required: true,
    });
  }

  if (rule.showSecretKey) {
    fields.push({
      key: "sk",
      inputType: "password",
      label: `${accessKeyName} Secret Key`.trim(),
      placeholder: `${accessKeyName} Secret Key`.trim(),
      required: true,
    });
  }

  if (rule.showRegion) {
    fields.push({
      key: "region",
      label: `${accessKeyName} Region`.trim(),
      placeholder: "us-east-1",
      required: true,
    });
  }

  if (rule.showApiUrl) {
    fields.push({
      key: "url",
      label: t("providerList.field.apiUrl"),
      placeholder: defaultUrl || t("providerList.placeholder.apiUrl"),
      required: !isGoogle,
    });
  }

  if (rule.showApiVersion) {
    fields.push({
      key: "api_version",
      label: code === "MicrosoftAzure" ? "Azure API Version" : "API Version",
      placeholder: "20XX-XX-XX",
    });
  }

  return fields;
}

export function shouldShowProviderConfigField(
  field: ProviderConfigField,
  provider: ProviderListItem | ProviderTemplate | null,
  authType: string,
) {
  if (!provider || !googleProviderCodes.has(provider.provider_code)) {
    return true;
  }

  if (authType === providerAuthType.serviceAccount) {
    return (
      googleServiceAccountFields.has(field.key) || field.key === "api_key" || field.key === "url"
    );
  }

  return !googleServiceAccountFields.has(field.key);
}

export function createDefaultProviderConfig(
  provider: ProviderTemplate | ProviderListItem | null,
): ProviderConfig {
  if (!provider) return {};

  const rule = getProviderConfigRule(provider);
  const defaultUrl = getDefaultProviderUrl(provider);

  return {
    ...(googleProviderCodes.has(provider.provider_code)
      ? { auth_type: providerAuthType.apiKey }
      : {}),
    ...(rule.showApiUrl && defaultUrl ? { url: defaultUrl } : {}),
  };
}

export function normalizeProviderConfig(
  config: ProviderConfig,
  provider?: ProviderIdentity | null,
): ProviderConfig {
  const normalized = Object.fromEntries(
    Object.entries(config).flatMap(([key, value]) => {
      if (typeof value === "string") {
        const trimmedValue = value.trim();
        return trimmedValue ? [[key, trimmedValue]] : [];
      }
      return value !== undefined && value !== null ? [[key, value]] : [];
    }),
  ) as ProviderConfig;

  if (!provider) return normalized;

  const rule = getProviderConfigRule(provider);
  if (!rule.showApiKey) delete normalized.api_key;
  if (!rule.showApiUrl) delete normalized.url;
  if (!rule.showAccessKey) delete normalized.ak;
  if (!rule.showSecretKey) delete normalized.sk;
  if (!rule.showRegion) delete normalized.region;
  if (!rule.showApiVersion) delete normalized.api_version;

  return normalized;
}

/** 解析 Google Service Account JSON，文件内容只在浏览器本地写入当前表单。 */
export function parseGoogleServiceAccountJson(content: string): ProviderConfig {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Google Service Account JSON must be an object");
  }

  return parsed as ProviderConfig;
}

/** 合并本地导入的 Google 服务账号配置，并切换到 Service Account 认证。 */
export function mergeGoogleServiceAccountConfig(
  currentConfig: ProviderConfig,
  importedConfig: ProviderConfig,
): ProviderConfig {
  return {
    ...currentConfig,
    ...importedConfig,
    auth_type: providerAuthType.serviceAccount,
  };
}

export function isValidProviderEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getProviderConfigRule(provider: ProviderIdentity): ProviderConfigRule {
  const categoryConfig = providerConfigByCategory[provider.category];
  const code = provider.provider_code;

  return {
    showApiKey: !categoryConfig.excludeApiKey.includes(code),
    showApiUrl: !categoryConfig.excludeApiUrl.includes(code),
    showApiVersion: categoryConfig.apiVersion.includes(code),
    showAccessKey: categoryConfig.accessKey.includes(code),
    showSecretKey: categoryConfig.secretKey.includes(code),
    showRegion: categoryConfig.region.includes(code),
  };
}

function getDefaultProviderUrl(provider: Pick<ProviderIdentity, "provider_code" | "name">) {
  const url = serviceProviderUrls[provider.provider_code];
  if (url) return url;

  const code = provider.provider_code.toLowerCase();
  const name = provider.name.toLowerCase();
  if (code.includes("magic") || name.includes("magic")) {
    return serviceProviderUrls.Magic;
  }

  return undefined;
}
