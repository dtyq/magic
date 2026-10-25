import { useMutation, useQueryClient } from "@tanstack/react-query";
import { providerModelListKeys } from "@magic-admin-v2/features/platform-model-list/queries";
import {
  useProviderModelDataSource,
  type ProviderModelDataSource,
} from "@magic-admin-v2/features/platform-model-list/utils/data-source";
import type {
  ProviderModelConnectivityTestByConfigPayload,
  ProviderModelSaveInput,
  ProviderModelSaveResult,
  ProviderModelRecord,
} from "@magic-admin-v2/features/platform-model-list/types";
import { providerListKeys } from "@magic-admin-v2/features/platform-provider-list/queries";
import type { ApiError } from "@magic-admin-v2/api/types";
import { useApis } from "@magic-admin-v2/runtime/context";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as ApiError).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "请求失败，请稍后重试。";
}

export type ProviderModelTaskProgress = {
  completed: number;
  currentIndex: number;
  status: "loading" | "success" | "failed";
  total: number;
};

type ProviderModelSaveRequest = {
  inputs: ProviderModelSaveInput[];
  onProgress?: (progress: ProviderModelTaskProgress) => void;
};

type ProviderModelDeleteRequest = {
  onProgress?: (progress: ProviderModelTaskProgress) => void;
  recordIds: string[];
};

type ProviderModelDetailsLoadRequest = {
  onProgress?: (progress: ProviderModelTaskProgress) => void;
  recordIds: string[];
};

export type ProviderModelConnectivityTestRequest =
  | { kind: "record"; recordId: string }
  | { kind: "config"; payload: ProviderModelConnectivityTestByConfigPayload };

export type ProviderModelDetailsLoadResult = {
  failedRecordIds: string[];
  records: ProviderModelRecord[];
};

export type ProviderModelDeleteResult = {
  failedRecordIds: string[];
};

async function saveOneProviderModel(
  input: ProviderModelSaveInput,
  dataSource: ProviderModelDataSource,
  api: ReturnType<typeof useApis>["platformModel"],
): Promise<ProviderModelSaveResult> {
  let recordId = input.existingRecordId;

  try {
    const record = await api.createProviderModel({
      ...input.payload,
      ...(recordId ? { id: recordId } : {}),
    }, dataSource);
    recordId = record.id;

    if (record.status !== input.desiredStatus) {
      await api.updateProviderModelStatus(recordId, input.desiredStatus, dataSource);
    }

    return {
      bindingKey: input.bindingKey,
      recordId,
      status: "success",
    };
  } catch (error) {
    return {
      bindingKey: input.bindingKey,
      recordId,
      status: "failed",
      errorMessage: getErrorMessage(error),
      retryInput: {
        ...input,
        ...(recordId ? { existingRecordId: recordId } : {}),
      },
    };
  }
}

export function useSaveProviderModelBindingsMutation() {
  const queryClient = useQueryClient();
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: async ({ inputs, onProgress }: ProviderModelSaveRequest) => {
      const results: ProviderModelSaveResult[] = [];

      for (const [index, input] of inputs.entries()) {
        onProgress?.({ completed: index, currentIndex: index, status: "loading", total: inputs.length });
        const result = await saveOneProviderModel(input, dataSource, platformModel);
        results.push(result);
        onProgress?.({
          completed: index + 1,
          currentIndex: index,
          status: result.status,
          total: inputs.length,
        });
      }

      return results;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerModelListKeys.all(dataSource.key) });
      void queryClient.invalidateQueries({ queryKey: providerListKeys.all });
    },
  });
}

export function useCreateProviderOriginalModelIdMutation() {
  const queryClient = useQueryClient();
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: (modelId: string) =>
      platformModel.createProviderOriginalModelId(modelId, dataSource),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: providerModelListKeys.originalModelIds(dataSource.key),
      });
    },
  });
}

export function useDeleteProviderOriginalModelIdMutation() {
  const queryClient = useQueryClient();
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: (id: string) =>
      platformModel.deleteProviderOriginalModelId(id, dataSource),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: providerModelListKeys.originalModelIds(dataSource.key),
      });
    },
  });
}

export function useDeleteProviderModelBindingsMutation() {
  const queryClient = useQueryClient();
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: async ({ onProgress, recordIds }: ProviderModelDeleteRequest): Promise<ProviderModelDeleteResult> => {
      const failedRecordIds: string[] = [];

      for (const [index, id] of recordIds.entries()) {
        onProgress?.({ completed: index, currentIndex: index, status: "loading", total: recordIds.length });
        try {
          await platformModel.deleteProviderModel(id, dataSource);
          onProgress?.({ completed: index + 1, currentIndex: index, status: "success", total: recordIds.length });
        } catch {
          failedRecordIds.push(id);
          onProgress?.({ completed: index + 1, currentIndex: index, status: "failed", total: recordIds.length });
        }
      }

      return { failedRecordIds };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerModelListKeys.all(dataSource.key) });
      void queryClient.invalidateQueries({ queryKey: providerListKeys.all });
    },
  });
}

export function useProviderModelConnectivityTestMutation() {
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: (request: ProviderModelConnectivityTestRequest) =>
      request.kind === "record"
        ? platformModel.testProviderModelConnectivity(request.recordId, dataSource)
        : platformModel.testProviderModelConnectivityByConfig(request.payload, dataSource),
  });
}

async function loadProviderModelDetailWithRetry(
  id: string,
  dataSource: ProviderModelDataSource,
  api: ReturnType<typeof useApis>["platformModel"],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await api.getProviderModelDetail(id, dataSource);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export function useLoadProviderModelDetailsMutation() {
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useMutation({
    mutationFn: async ({ onProgress, recordIds }: ProviderModelDetailsLoadRequest): Promise<ProviderModelDetailsLoadResult> => {
      const records: ProviderModelRecord[] = [];
      const failedRecordIds: string[] = [];

      for (const [index, id] of recordIds.entries()) {
        onProgress?.({ completed: index, currentIndex: index, status: "loading", total: recordIds.length });
        try {
          records.push(await loadProviderModelDetailWithRetry(id, dataSource, platformModel));
          onProgress?.({ completed: index + 1, currentIndex: index, status: "success", total: recordIds.length });
        } catch {
          failedRecordIds.push(id);
          onProgress?.({ completed: index + 1, currentIndex: index, status: "failed", total: recordIds.length });
        }
      }

      return { failedRecordIds, records };
    },
  });
}
