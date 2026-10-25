import enUSCommon from "@magic-admin-v2/i18n/messages/base/en_US/common.json";
import zhCNCommon from "@magic-admin-v2/i18n/messages/base/zh_CN/common.json";
import {
  Language,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources";

const requestFailedMessages: Record<LanguageCode, string> = {
  [Language.ZhCN]: zhCNCommon.requestFailed,
  [Language.EnUS]: enUSCommon.requestFailed,
};

/**
 * The standalone client can fail before I18nProvider mounts, so it needs a
 * tiny synchronous fallback. The text still comes from canonical common.json
 * resources instead of being duplicated in a second translation catalog.
 */
export function getRequestFailedMessage(language: LanguageCode) {
  return requestFailedMessages[language] ?? requestFailedMessages[Language.ZhCN];
}
