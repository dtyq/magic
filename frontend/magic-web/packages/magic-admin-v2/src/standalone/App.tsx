import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, useRoutes } from "react-router-dom";
import type { ApiError } from "@magic-admin-v2/api/types";
import { isUnauthorizedError } from "@magic-admin-v2/api/types";
import { RuntimeMode } from "@magic-admin-v2/constants/runtime";
import {
  toIntlLocale,
  type Language,
} from "@magic-admin-v2/i18n/resources";
import { createRouteObjects } from "@magic-admin-v2/routes/createRouteObjects";
import type { Route } from "@magic-admin-v2/routes/types";
import { RuntimeProvider } from "@magic-admin-v2/runtime/RuntimeProvider";
import type { BridgeConfig, Theme } from "@magic-admin-v2/runtime/types";
import { createStandaloneRequestContext } from "@magic-admin-v2/standalone/api/context";
import { createStandaloneApiClients } from "@magic-admin-v2/standalone/api/createClients";
import { readStandaloneConfig } from "@magic-admin-v2/standalone/config";
import { getStandaloneMessage } from "@magic-admin-v2/standalone/messages";
import { loadStandaloneSession } from "@magic-admin-v2/standalone/organization/loadSession";
import type { StandaloneSession } from "@magic-admin-v2/standalone/organization/types";
import { createStandaloneUploadCapabilities } from "@magic-admin-v2/standalone/upload/createCapabilities";

type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error" }
  | { status: "ready"; session: StandaloneSession };

export default function App() {
  const [unauthorizedError, setUnauthorizedError] = useState<ApiError | null>(null);
  const [resources] = useState(() => {
    const config = readStandaloneConfig();
    const context = createStandaloneRequestContext(config);
    const clients = createStandaloneApiClients({
      config,
      context,
      onUnauthorized: setUnauthorizedError,
    });
    return {
      capabilities: createStandaloneUploadCapabilities({ clients, config, context }),
      clients,
      config,
      context,
    };
  });
  const [language, setLanguage] = useState(resources.config.language);
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading" });

  const handleLanguageChange = useCallback(
    (nextLanguage: Language) => {
      resources.context.setLanguage(nextLanguage);
      setLanguage(nextLanguage);
    },
    [resources],
  );

  useEffect(() => {
    document.documentElement.lang = toIntlLocale(language);
  }, [language]);

  useEffect(() => {
    let active = true;
    void loadStandaloneSession(resources).then(
      (session) => {
        if (active) setSessionState({ status: "ready", session });
      },
      (error: unknown) => {
        if (!active) return;
        setSessionState({
          status: isUnauthorizedError(error) ? "unauthenticated" : "error",
        });
      },
    );
    return () => {
      active = false;
    };
  }, [resources]);

  const switchOrganization = useCallback(
    async (organizationCode: string) => {
      const previousMagicOrganizationCode = resources.context.getMagicOrganizationCode();
      const previousTeamshareOrganizationCode =
        resources.context.getTeamshareOrganizationCode();
      const currentSession = sessionState.status === "ready" ? sessionState.session : null;
      const targetOrganization = currentSession?.organizations.find(
        (organization) => organization.organizationCode === organizationCode,
      );

      resources.context.setOrganization({
        magicOrganizationCode: organizationCode,
        teamshareOrganizationCode:
          targetOrganization?.teamshareOrganizationCode || organizationCode,
      });

      try {
        const session = await loadStandaloneSession({
          ...resources,
          organizationCode,
        });
        setSessionState({ status: "ready", session });
      } catch (error) {
        resources.context.setOrganization({
          magicOrganizationCode: previousMagicOrganizationCode,
          teamshareOrganizationCode: previousTeamshareOrganizationCode,
        });
        throw error;
      }
    },
    [resources, sessionState],
  );

  if (sessionState.status !== "ready") {
    const key =
      sessionState.status === "loading"
        ? "loading"
        : sessionState.status === "unauthenticated"
          ? "unauthenticated"
          : "loadFailed";
    return (
      <StandaloneStateMessage
        message={getStandaloneMessage(language, key)}
      />
    );
  }

  const { session } = sessionState;
  const runtimeConfig: BridgeConfig = {
    mode: RuntimeMode.Standalone,
    apiClients: resources.clients,
    capabilities: resources.capabilities,
    auth: {
      status: "authenticated",
      authorization: session.authorization,
    },
    user: session.user,
    organization: {
      current: session.currentOrganization,
      organizations: session.organizations,
      switchOrganization,
    },
    language,
    onLanguageChange: handleLanguageChange,
    theme: getStandaloneTheme(),
    onUnauthorized: setUnauthorizedError,
  };

  return (
    <BrowserRouter basename="/admin-v2">
      <RuntimeProvider {...runtimeConfig}>
        <StandaloneRoutes />
        {unauthorizedError ? (
          <SessionExpiredBanner
            message={getStandaloneMessage(
              language,
              "sessionExpired",
            )}
          />
        ) : null}
      </RuntimeProvider>
    </BrowserRouter>
  );
}

function StandaloneRoutes() {
  const [developmentRoutes, setDevelopmentRoutes] = useState<
    readonly Route[] | null
  >(import.meta.env.DEV ? null : []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let active = true;
    void import("@magic-admin-v2/standalone/routes/development").then(
      (module) => {
        if (active) setDevelopmentRoutes(module.developmentRoutes);
      },
      () => {
        if (active) setDevelopmentRoutes([]);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const routeObjects = useMemo(
    () =>
      createRouteObjects(RuntimeMode.Standalone, {
        developmentRoutes: developmentRoutes ?? [],
      }),
    [developmentRoutes],
  );
  const element = useRoutes(routeObjects);
  if (developmentRoutes === null) return null;
  return element;
}

function SessionExpiredBanner({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-4 top-4 z-[100] rounded-lg border border-destructive/30 bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg sm:left-auto sm:max-w-md">
      {message}
    </div>
  );
}

function StandaloneStateMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <p className="max-w-lg rounded-lg border bg-card px-6 py-5 text-center text-sm shadow-sm">
        {message}
      </p>
    </div>
  );
}

function getStandaloneTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
