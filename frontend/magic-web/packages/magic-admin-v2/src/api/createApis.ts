import { createBaseApis } from "@magic-admin-v2/api/base/createApis";
import { createEditionApis } from "@magic-admin-v2/api/edition";
import type { ApiClients } from "@magic-admin-v2/api/types";

export function createApis(clients: ApiClients) {
  return {
    ...createBaseApis(clients),
    ...createEditionApis(clients),
  };
}

export type Apis = ReturnType<typeof createApis>;
