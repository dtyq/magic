import { z } from "zod";
import {
  googleProviderCodes,
  isValidProviderEmail,
  shouldShowProviderConfigField,
  type ProviderConfigField,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-config";
import {
  providerAuthType,
  type ProviderListItem,
  type ProviderTemplate,
} from "@magic-admin-v2/features/platform-provider-list/types";

type Translate = (key: string) => string;

type ProviderFormSchemaOptions = {
  /** 企业版平台服务商开启代理后，必须选择一台代理服务器。 */
  requireProxyServer?: boolean;
};

export function createProviderFormSchema(
  t: Translate,
  fields: ProviderConfigField[],
  provider?: ProviderListItem | ProviderTemplate | null,
  options: ProviderFormSchemaOptions = {},
) {
  return z
    .object({
      service_provider_id: z.string().optional(),
      alias: z.string().trim().max(100, t("providerList.validation.aliasTooLong")),
      alias_en: z.string().trim().max(100, t("providerList.validation.aliasTooLong")),
      sort: z.number().int().min(0, t("providerList.validation.sortMin")),
      status: z.boolean(),
      config: z.record(z.string(), z.unknown()),
    })
    .superRefine((value, context) => {
      if (
        options.requireProxyServer &&
        value.config.use_proxy === true &&
        !hasSelectedProxyServer(value.config.proxy_server)
      ) {
        context.addIssue({
          code: "custom",
          message: t("providerList.validation.proxyServerRequired"),
          path: ["config", "proxy_server"],
        });
      }

      if (!value.status) return;

      const authType =
        typeof value.config.auth_type === "string" ? value.config.auth_type : providerAuthType.apiKey;
      const isFieldVisible = (field: ProviderConfigField) =>
        shouldShowProviderConfigField(field, provider ?? null, authType);

      fields.forEach((field) => {
        if (!field.required || !isFieldVisible(field)) return;

        const fieldValue = value.config[field.key];
        if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
          context.addIssue({
            code: "custom",
            message: t("providerList.validation.configRequired"),
            path: ["config", field.key],
          });
        }
      });

      const urlField = fields.find((field) => field.key === "url");
      const url = value.config.url;
      if (
        urlField &&
        isFieldVisible(urlField) &&
        typeof url === "string" &&
        url.trim() &&
        !/^https?:\/\/[^ ]+$/.test(url.trim())
      ) {
        context.addIssue({
          code: "custom",
          message: t("providerList.validation.urlInvalid"),
          path: ["config", "url"],
        });
      }

      const clientEmail = value.config.client_email;
      if (
        provider &&
        googleProviderCodes.has(provider.provider_code) &&
        authType === providerAuthType.serviceAccount &&
        typeof clientEmail === "string" &&
        clientEmail.trim() &&
        !isValidProviderEmail(clientEmail)
      ) {
        context.addIssue({
          code: "custom",
          message: t("providerList.validation.emailInvalid"),
          path: ["config", "client_email"],
        });
      }

    });
}

export function createAddProviderFormSchema(
  t: Translate,
  fields: ProviderConfigField[],
  provider?: ProviderTemplate | null,
) {
  return createProviderFormSchema(t, fields, provider).superRefine((value, context) => {
    if (!value.service_provider_id) {
      context.addIssue({
        code: "custom",
        message: t("providerList.validation.templateRequired"),
        path: ["service_provider_id"],
      });
    }
  });
}

/** 判断代理配置是否包含可提交的代理服务器 ID。 */
export function hasSelectedProxyServer(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) return false;
  return typeof value.id === "string" && value.id.trim().length > 0;
}
