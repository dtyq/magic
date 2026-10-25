import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Toaster } from "@magic-admin-v2/components/ui/sonner";
import { createApis } from "@magic-admin-v2/api/createApis";
import { RuntimeMode } from "@magic-admin-v2/constants/runtime";
import { I18nProvider } from "@magic-admin-v2/i18n/i18n-provider";
import { DashboardLayoutSkeleton } from "@magic-admin-v2/layouts/dashboard-layout-skeleton";
import { OrganizationScope } from "@magic-admin-v2/runtime/OrganizationScope";
import { RuntimeContext, type RuntimeValue } from "@magic-admin-v2/runtime/context";
import type { AccessContext, BridgeConfig, Theme } from "@magic-admin-v2/runtime/types";

type RuntimeProviderProps = PropsWithChildren<BridgeConfig>;

export function RuntimeProvider(props: RuntimeProviderProps) {
  const organizationKey = props.organization.current.organizationCode;

  return (
    <I18nProvider
      fallback={<DashboardLayoutSkeleton />}
      includeDevelopment={props.mode === RuntimeMode.Standalone && import.meta.env.DEV}
      language={props.language}
      onLanguageChange={props.onLanguageChange}
    >
      <OrganizationScope key={organizationKey}>
        <RuntimeScope {...props} />
      </OrganizationScope>
    </I18nProvider>
  );
}

function RuntimeScope({ children, ...config }: RuntimeProviderProps) {
  const { onThemeChange } = config;
  const [internalTheme, setInternalTheme] = useState<Theme>(() =>
    readStoredTheme() ?? config.theme ?? config.defaultTheme ?? "light",
  );
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const previousThemeProp = useRef(config.theme);
  const clearThemeTransitionFrame = useRef<number | null>(null);

  useEffect(() => {
    if (config.theme && config.theme !== previousThemeProp.current) {
      setInternalTheme(config.theme);
    }
    previousThemeProp.current = config.theme;
  }, [config.theme]);

  const theme = onThemeChange ? config.theme ?? internalTheme : internalTheme;
  const setTheme = useCallback(
    (nextTheme: Theme) => {
      if (nextTheme === theme) return;

      setIsThemeSwitching(true);
      setInternalTheme(nextTheme);
      writeStoredTheme(nextTheme);
      void onThemeChange?.(nextTheme);

      if (typeof window === "undefined") {
        setIsThemeSwitching(false);
        return;
      }

      if (clearThemeTransitionFrame.current !== null) {
        window.cancelAnimationFrame(clearThemeTransitionFrame.current);
      }
      clearThemeTransitionFrame.current = window.requestAnimationFrame(() => {
        clearThemeTransitionFrame.current = window.requestAnimationFrame(() => {
          setIsThemeSwitching(false);
          clearThemeTransitionFrame.current = null;
        });
      });
    },
    [onThemeChange, theme],
  );

  useEffect(() => {
    return () => {
      if (clearThemeTransitionFrame.current !== null) {
        window.cancelAnimationFrame(clearThemeTransitionFrame.current);
      }
    };
  }, []);
  const currentOrganization = config.organization.current;
  const user = config.user;
  const authorization =
    config.auth.status === "authenticated" ? config.auth.authorization : null;
  const authorizationLoading = config.auth.status === "loading";
  const authorizationError = config.auth.status === "error" ? config.auth.error : null;

  const apis = useMemo(() => createApis(config.apiClients), [config.apiClients]);
  const access = useMemo<AccessContext | null>(() => {
    if (!authorization || !user) return null;
    return {
      ...authorization,
      user,
      organization: currentOrganization,
    };
  }, [authorization, currentOrganization, user]);

  const value = useMemo<RuntimeValue>(
    () => ({
      ...config,
      theme,
      setTheme,
      isThemeSwitching,
      access,
      authorizationLoading,
      authorizationError,
      apis,
    }),
    [
      access,
      apis,
      authorizationError,
      authorizationLoading,
      config,
      isThemeSwitching,
      setTheme,
      theme,
    ],
  );

  return (
    <RuntimeContext.Provider value={value}>
      <div
        className={[
          "magic-admin-shell",
          theme === "dark" ? "dark" : "",
          isThemeSwitching ? "theme-switching" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
        {config.mode === RuntimeMode.Standalone ? <Toaster /> : null}
      </div>
    </RuntimeContext.Provider>
  );
}

const themeStorageKey = "magic_admin_v2_theme";

function readStoredTheme(): Theme | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(themeStorageKey);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Storage may be unavailable in embedded or privacy-restricted contexts.
  }
}
