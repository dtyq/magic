import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import { platformProviderModelDataSource, type ProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source";
import type {
  ProviderModelGroupPage,
  ProviderModelGroupQueryParams,
  ProviderModelConnectivityTestByConfigPayload,
  ProviderModelConnectivityTestResult,
  ProviderModelRecord,
  ProviderModelStatus,
  ProviderOriginalModelId,
  ProviderModelPricingTemplate,
  SaveProviderModelPayload,
} from "@magic-admin-v2/features/platform-model-list/types";

export function createPlatformModelApi(client: HttpClient) {
  return {
    getProviderModelGroups(
      params: ProviderModelGroupQueryParams,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.post<ProviderModelGroupPage>(
        dataSource.endpoints.modelGroupList,
        params,
        options,
      );
    },
    getProviderModelImportSources(
      category: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      if (!dataSource.endpoints.modelImportList) {
        return Promise.resolve([] as ProviderModelRecord[]);
      }

      return client.post<ProviderModelRecord[]>(
        dataSource.endpoints.modelImportList,
        { category },
        options,
      );
    },
    getProviderOriginalModelIds(
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.get<ProviderOriginalModelId[]>(dataSource.endpoints.modelOriginalIds, options);
    },
    createProviderOriginalModelId(
      modelId: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.post<null>(
        dataSource.endpoints.modelOriginalIdCreate,
        { model_id: modelId },
        options,
      );
    },
    deleteProviderOriginalModelId(
      id: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.delete<null>(
        buildApiUrl(dataSource.endpoints.modelOriginalIdDelete, { id }),
        undefined,
        options,
      );
    },
    getProviderModelPricingTemplates(
      { category, providerCode }: { category: string; providerCode: string },
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      if (!dataSource.endpoints.modelPricingTemplates) {
        return Promise.resolve([] as ProviderModelPricingTemplate[]);
      }

      return client.get<ProviderModelPricingTemplate[]>(
        buildApiUrl(dataSource.endpoints.modelPricingTemplates, undefined, {
          category,
          provider_code: providerCode,
        }),
        options,
      );
    },
    createProviderModel(
      values: SaveProviderModelPayload,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.post<ProviderModelRecord>(dataSource.endpoints.modelCreate, values, options);
    },
    testProviderModelConnectivity(
      recordId: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.post<ProviderModelConnectivityTestResult>(
        dataSource.endpoints.modelConnectivityTest,
        { model_id: recordId },
        options,
      );
    },
    testProviderModelConnectivityByConfig(
      values: ProviderModelConnectivityTestByConfigPayload,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.post<ProviderModelConnectivityTestResult>(
        dataSource.endpoints.modelConnectivityTestByConfig,
        values,
        options,
      );
    },
    getProviderModelDetail(
      id: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.get<ProviderModelRecord>(
        buildApiUrl(dataSource.endpoints.modelDetail, { id }),
        options,
      );
    },
    deleteProviderModel(
      id: string,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.delete<null>(buildApiUrl(dataSource.endpoints.modelDetail, { id }), undefined, options);
    },
    updateProviderModelStatus(
      id: string,
      status: ProviderModelStatus,
      dataSource: ProviderModelDataSource = platformProviderModelDataSource,
      options?: RequestOptions,
    ) {
      return client.put<null>(
        buildApiUrl(dataSource.endpoints.modelStatus, { id }),
        { status },
        options,
      );
    },
  };
}
