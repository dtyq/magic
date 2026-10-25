import {
  createDefaultProviderConfig,
  normalizeProviderConfig,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-config";
import {
  providerStatus,
  type AddProviderParams,
  type ProviderFormValues,
  type ProviderListItem,
  type ProviderTemplate,
  type UpdateProviderParams,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function createEmptyProviderFormValues(): ProviderFormValues {
  return {
    service_provider_id: "",
    alias: "",
    alias_en: "",
    sort: 0,
    status: true,
    config: {},
  };
}

export function toProviderFormValues(provider: ProviderListItem): ProviderFormValues {
  return {
    service_provider_id: provider.service_provider_id,
    alias: provider.alias ?? "",
    alias_en: provider.translate?.alias?.en_US ?? "",
    sort: provider.sort ?? 0,
    status: provider.status === providerStatus.enabled,
    config: {
      ...createDefaultProviderConfig(provider),
      ...(provider.config ?? {}),
    },
  };
}

/** 切换服务商模板时保留基础表单内容，但重置上一模板的连接配置。 */
export function applyProviderTemplateSelection(
  values: ProviderFormValues,
  template: ProviderTemplate,
): ProviderFormValues {
  return {
    ...values,
    service_provider_id: template.id,
    config: createDefaultProviderConfig(template),
  };
}

export function toAddProviderParams(
  values: ProviderFormValues,
  template: ProviderTemplate | null,
): AddProviderParams {
  return {
    alias: values.alias.trim(),
    config: normalizeProviderConfig(values.config, template),
    service_provider_id: values.service_provider_id ?? "",
    status: values.status ? providerStatus.enabled : providerStatus.disabled,
    translate: {
      alias: {
        zh_CN: values.alias.trim(),
        en_US: values.alias_en.trim() || undefined,
      },
    },
  };
}

export function toEditProviderParams(
  provider: ProviderListItem,
  values: ProviderFormValues,
): UpdateProviderParams {
  return {
    id: provider.id,
    status: values.status ? providerStatus.enabled : providerStatus.disabled,
    config: normalizeProviderConfig(values.config, provider),
    alias: values.alias.trim(),
    sort: values.sort,
    provider_code: provider.provider_code,
    translate: {
      alias: {
        ...(provider.translate?.alias ?? {}),
        zh_CN: values.alias.trim(),
        en_US: values.alias_en.trim() || undefined,
      },
    },
  };
}

export function toProviderStatusUpdateParams(
  provider: ProviderListItem,
  checked: boolean,
): UpdateProviderParams {
  return {
    id: provider.id,
    status: checked ? providerStatus.enabled : providerStatus.disabled,
    config: provider.config ?? {},
    alias: provider.alias ?? "",
    sort: provider.sort ?? 0,
    provider_code: provider.provider_code,
    translate: provider.translate ?? { alias: { zh_CN: provider.alias ?? "" } },
  };
}
