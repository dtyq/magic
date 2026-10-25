import type { ApiClients } from "@magic-admin-v2/api/types";

export function createEditionApis(clients: ApiClients) {
  void clients;
  return {};
}

export type EditionApis = ReturnType<typeof createEditionApis>;
