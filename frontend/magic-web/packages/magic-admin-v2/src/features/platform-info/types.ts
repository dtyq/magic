import type {
  IdentityWatermarkDepth,
  IdentityWatermarkField,
  IdentityWatermarkValue,
} from "@magic-admin-v2/components/identity-watermark/watermark-utils";
import type { Language } from "@magic-admin-v2/i18n/resources";

import type { ModelBillingMultiplierSettings as SharedModelBillingMultiplierSettings } from "../../../../model-billing-reference";

export type PlatformLocale = Language;

export type PlatformLocalizedText = Partial<Record<PlatformLocale, string>>;

export type PlatformInfoFooterFiling = {
  enabled: boolean;
  number: string;
  link: string;
};

export type PlatformInfoFooter = {
  copyright_i18n: PlatformLocalizedText;
  filing: PlatformInfoFooterFiling;
};

/** 组织水印中可展示的用户信息字段；复用跨 feature 的身份水印共享类型。 */
export type PlatformWatermarkField = IdentityWatermarkField;

/** 组织水印的深浅档位，与后端 `watermark.depth` 的取值保持一致。 */
export type PlatformWatermarkDepth = IdentityWatermarkDepth;

/** 组织水印配置；后端只返回 enabled、fields、depth 三个字段。 */
export type PlatformInfoWatermark = IdentityWatermarkValue;

/** 价格原文透传；后端提供默认值与最终参考金额。 */
export type ModelBillingMultiplierSettings = SharedModelBillingMultiplierSettings;

export type PlatformInfoDetails = {
  model_billing_multiplier?: ModelBillingMultiplierSettings;
  logo: PlatformLocalizedText;
  favicon: string | null;
  minimal_logo: string | null;
  default_language: PlatformLocale | string;
  footer?: PlatformInfoFooter;
  watermark?: PlatformInfoWatermark;
  name_i18n: PlatformLocalizedText;
  title_i18n: PlatformLocalizedText;
  keywords_i18n: PlatformLocalizedText;
  description_i18n: PlatformLocalizedText;
  agent_role_name_i18n?: PlatformLocalizedText;
  agent_role_description_i18n?: PlatformLocalizedText;
  global_system_prompt?: string;
  custom_service_provider_whitelist?: string[];
};

export type PlatformInfoFormState = {
  model_billing_multiplier: ModelBillingMultiplierSettings;
  logo: Record<PlatformLocale, string>;
  favicon: string;
  minimal_logo: string;
  default_language: PlatformLocale;
  footer: {
    copyright_i18n: Record<PlatformLocale, string>;
    filing: PlatformInfoFooterFiling;
  };
  watermark: PlatformInfoWatermark;
  name_i18n: Record<PlatformLocale, string>;
  title_i18n: Record<PlatformLocale, string>;
  keywords_i18n: Record<PlatformLocale, string>;
  description_i18n: Record<PlatformLocale, string>;
  agent_role_name_i18n: Record<PlatformLocale, string>;
  agent_role_description_i18n: Record<PlatformLocale, string>;
  global_system_prompt: string;
};

export type UpdatePlatformInfoParams = {
  model_billing_multiplier: Omit<ModelBillingMultiplierSettings, "base_price_cny">;
  logo_zh_url: string;
  logo_en_url: string;
  minimal_logo_url: string;
  favicon_url: string;
  default_language: PlatformLocale;
  footer: PlatformInfoFormState["footer"];
  watermark: PlatformInfoWatermark;
  name_i18n: Record<PlatformLocale, string>;
  title_i18n: Record<PlatformLocale, string>;
  keywords_i18n: Record<PlatformLocale, string>;
  description_i18n: Record<PlatformLocale, string>;
  agent_role_name_i18n: Record<PlatformLocale, string>;
  agent_role_description_i18n: Record<PlatformLocale, string>;
  global_system_prompt: string;
};
