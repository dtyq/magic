import type { Language } from "@magic-admin-v2/i18n/resources";

export type EditorTabValue = "common" | "runtime" | "providers";

export type ModelEditorFocusRequest = {
  fieldId: string;
  id: number;
  locale?: Language;
  providerIndex?: number;
  providerSection?: "optional" | "pricing";
  pricingBillingObject?: string;
  tab: EditorTabValue;
};
