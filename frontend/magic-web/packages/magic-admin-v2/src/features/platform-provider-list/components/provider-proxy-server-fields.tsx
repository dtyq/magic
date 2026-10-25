import type { UseFormReturn } from "react-hook-form";
import type { ProviderFormValues } from "@magic-admin-v2/features/platform-provider-list/types";

export const providerProxyServerSupported = false;

/** 开源版不提供平台代理服务器能力；企业版通过同路径组件覆盖实现。 */
export function ProviderProxyServerFields({
  disabled,
  form,
}: {
  disabled?: boolean;
  form: UseFormReturn<ProviderFormValues>;
}) {
  void disabled;
  void form;
  return null;
}
