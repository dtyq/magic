import { useMemo } from "react";
import { createContactOrganizationSelectorAdapters } from "@magic-admin-v2/components/organization-selectors/contact-organization";
import { useApis } from "@magic-admin-v2/runtime/context";

/** 为 React 页面注入统一的 Magic 联系人 API，并保持选择器回调引用稳定。 */
export function useContactOrganizationSelector() {
  const { contactOrganization } = useApis();

  return useMemo(
    () => createContactOrganizationSelectorAdapters(contactOrganization),
    [contactOrganization],
  );
}
