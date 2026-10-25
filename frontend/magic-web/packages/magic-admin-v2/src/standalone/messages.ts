import {
  Language,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources";

const messages = {
  [Language.ZhCN]: {
    loading: "正在加载管理后台…",
    loadFailed: "管理后台初始化失败，请检查本地认证和组织配置。",
    unauthenticated: "当前会话不可用，请配置本地认证后刷新页面。",
    sessionExpired: "当前会话已失效，请重新认证后刷新页面。",
  },
  [Language.EnUS]: {
    loading: "Loading the admin console…",
    loadFailed:
      "Failed to initialize the admin console. Check the local authentication and organization configuration.",
    unauthenticated:
      "The current session is unavailable. Configure local authentication and refresh the page.",
    sessionExpired:
      "The current session has expired. Authenticate again and refresh the page.",
  },
} as const;

export type StandaloneMessageKey = keyof (typeof messages)[typeof Language.ZhCN];

export function getStandaloneMessage(
  language: LanguageCode,
  key: StandaloneMessageKey,
) {
  return messages[language][key];
}
