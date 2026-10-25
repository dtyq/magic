import { BaseRequestUrl } from "@magic-admin-v2/api/constants/base";
import { EditionRequestUrl } from "@magic-admin-v2/api/constants/edition";
import { ExperimentalBaseRequestUrl } from "@magic-admin-v2/api/constants/experimental-base";
import { ExperimentalEditionRequestUrl } from "@magic-admin-v2/api/constants/experimental-edition";

export const RequestUrl = {
  ...BaseRequestUrl,
  ...EditionRequestUrl,
  ...ExperimentalBaseRequestUrl,
  ...ExperimentalEditionRequestUrl,
} as const;

export {
  BaseRequestUrl,
  EditionRequestUrl,
  ExperimentalBaseRequestUrl,
  ExperimentalEditionRequestUrl,
};
