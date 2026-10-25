import type { ApiError } from "@magic-admin-v2/api/types";
import type { StandaloneRequestContext } from "@magic-admin-v2/standalone/api/context";
import type { StandaloneConfig } from "@magic-admin-v2/standalone/config";

export type CreateEditionClientsOptions = {
  config: StandaloneConfig;
  context: StandaloneRequestContext;
  onUnauthorized: (error: ApiError) => void;
};
