import {
  defaultLanguage,
  languageStorageKey,
  normalizeLanguage,
  type Language,
} from "@magic-admin-v2/i18n/resources";
import {
  readStandaloneEditionConfig,
  type StandaloneEditionConfig,
} from "@magic-admin-v2/standalone/config-edition";

export const standaloneStorageKeys = {
  magicAccessToken: "magic_admin_access_token",
  magicOrganizationCode: "magic_admin_organization_code",
  teamshareOrganizationCode: "magic_admin_teamshare_organization_code",
} as const;

type StandaloneBaseConfig = {
  language: Language;
  magicAuthorization: string;
  magicBaseUrl: string;
  magicOrganizationCode: string;
  teamshareOrganizationCode: string;
  userAvatar: string;
  userId: string;
  userName: string;
};

export type StandaloneConfig = StandaloneBaseConfig & StandaloneEditionConfig;

function readEnv(name: string) {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function readStorage(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key)?.trim() ?? "";
}

function getMagicAuthorization() {
  const token =
    readFirstEnv(["VITE_DEV_MAGIC_AUTH_TOKEN", "VITE_DEV_AUTH_TOKEN"]) ||
    readStorage(standaloneStorageKeys.magicAccessToken);
  const prefix = readFirstEnv([
    "VITE_DEV_MAGIC_AUTH_TOKEN_PREFIX",
    "VITE_DEV_AUTH_TOKEN_PREFIX",
  ]);
  if (!token) return "";
  return prefix ? `${prefix} ${token}` : token;
}

function readFirstEnv(names: readonly string[]) {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

function getLanguage(): Language {
  const language = readEnv("VITE_DEV_LANGUAGE") || readStorage(languageStorageKey);
  return language ? normalizeLanguage(language) : defaultLanguage;
}

export function readStandaloneConfig(): StandaloneConfig {
  return {
    ...readStandaloneEditionConfig(),
    language: getLanguage(),
    magicAuthorization: getMagicAuthorization(),
    magicBaseUrl: readEnv("VITE_API_BASE_URL"),
    magicOrganizationCode:
      readEnv("VITE_DEV_MAGIC_ORGANIZATION_CODE") ||
      readStorage(standaloneStorageKeys.magicOrganizationCode),
    teamshareOrganizationCode:
      readEnv("VITE_DEV_TEAMSHARE_ORGANIZATION_CODE") ||
      readStorage(standaloneStorageKeys.teamshareOrganizationCode),
    userAvatar: readEnv("VITE_DEV_USER_AVATAR"),
    userId: readEnv("VITE_DEV_USER_ID") || "standalone-admin",
    userName: readEnv("VITE_DEV_USER_NAME") || "Standalone Admin",
  };
}
