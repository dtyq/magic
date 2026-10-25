import { QueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@magic-admin-v2/api/types";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 1,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
