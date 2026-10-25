import type { ApiClients, ApiError } from "@magic-admin-v2/api/types";
import { createStandaloneHttpClient } from "@magic-admin-v2/standalone/api/client";
import type { StandaloneRequestContext } from "@magic-admin-v2/standalone/api/context";
import { createEditionClients } from "@magic-admin-v2/standalone/api/edition-clients";
import type { StandaloneConfig } from "@magic-admin-v2/standalone/config";

export function createStandaloneApiClients({
  config,
  context,
  onUnauthorized,
}: {
  config: StandaloneConfig;
  context: StandaloneRequestContext;
  onUnauthorized: (error: ApiError) => void;
}): ApiClients {
  let unauthorizedNotified = false;
  const notifyUnauthorized = (error: ApiError) => {
    if (unauthorizedNotified) return;
    unauthorizedNotified = true;
    onUnauthorized(error);
  };
  const magic = createStandaloneHttpClient({
    baseURL: config.magicBaseUrl,
    context,
    getAuthorization: context.getMagicAuthorization,
    getOrganizationCode: context.getMagicOrganizationCode,
    onUnauthorized: notifyUnauthorized,
    service: "magic",
  });

  return {
    magic,
    ...createEditionClients({
      config,
      context,
      onUnauthorized: notifyUnauthorized,
    }),
  };
}
