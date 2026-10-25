import {
  languageStorageKey,
  type Language,
} from "@magic-admin-v2/i18n/resources";
import {
  standaloneStorageKeys,
  type StandaloneConfig,
} from "@magic-admin-v2/standalone/config";

export type StandaloneRequestContext = {
  getMagicAuthorization(): string;
  getLanguage(): Language;
  getMagicOrganizationCode(): string;
  getTeamshareOrganizationCode(): string;
  setOrganization(input: {
    magicOrganizationCode: string;
    teamshareOrganizationCode?: string;
  }): void;
  setLanguage(language: Language): void;
};

export function createStandaloneRequestContext(
  config: StandaloneConfig,
): StandaloneRequestContext {
  let magicOrganizationCode = config.magicOrganizationCode;
  let teamshareOrganizationCode = config.teamshareOrganizationCode;
  let language = config.language;

  return {
    getMagicAuthorization: () => config.magicAuthorization,
    getLanguage: () => language,
    getMagicOrganizationCode: () => magicOrganizationCode,
    getTeamshareOrganizationCode: () => teamshareOrganizationCode,
    setOrganization(input) {
      magicOrganizationCode = input.magicOrganizationCode;
      teamshareOrganizationCode =
        input.teamshareOrganizationCode || input.magicOrganizationCode;

      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        standaloneStorageKeys.magicOrganizationCode,
        magicOrganizationCode,
      );
      window.localStorage.setItem(
        standaloneStorageKeys.teamshareOrganizationCode,
        teamshareOrganizationCode,
      );
    },
    setLanguage(nextLanguage) {
      language = nextLanguage;
      if (typeof window === "undefined") return;
      window.localStorage.setItem(languageStorageKey, language);
    },
  };
}
