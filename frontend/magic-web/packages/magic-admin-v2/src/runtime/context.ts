import { createContext, useContext } from "react";
import type { Apis } from "@magic-admin-v2/api/createApis";
import type { AccessContext, BridgeConfig } from "@magic-admin-v2/runtime/types";

export type RuntimeValue = BridgeConfig & {
  theme: NonNullable<BridgeConfig["theme"]>;
  setTheme: (theme: NonNullable<BridgeConfig["theme"]>) => void;
  isThemeSwitching: boolean;
  access: AccessContext | null;
  authorizationLoading: boolean;
  authorizationError: Error | null;
  apis: Apis;
};

export const RuntimeContext = createContext<RuntimeValue | null>(null);

export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("useRuntime must be used inside RuntimeProvider");
  return value;
}

export function useApis() {
  return useRuntime().apis;
}
