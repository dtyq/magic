import { RequestUrl } from "@magic-admin-v2/api/constants";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import type {
  AddProviderParams,
  ProviderCategory,
  ProviderListItem,
  ProviderTemplate,
  UpdateProviderParams,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function createPlatformProviderApi(client: HttpClient) {
  return {
    getProviderList(
      category: ProviderCategory,
      endpoint: string = RequestUrl.providerList,
      options?: RequestOptions,
    ) {
      return client.get<ProviderListItem[]>(buildApiUrl(endpoint, undefined, { category }), options);
    },
    getProviderTemplates(category?: ProviderCategory | null, options?: RequestOptions) {
      return client.get<ProviderTemplate[]>(
        buildApiUrl(RequestUrl.providerTemplates, undefined, { category }),
        options,
      );
    },
    getProviderDetail(id: string, options?: RequestOptions) {
      return client.get<ProviderListItem>(buildApiUrl(RequestUrl.providerDetail, { id }), options);
    },
    addProvider(values: AddProviderParams, options?: RequestOptions) {
      return client.post<ProviderListItem>(RequestUrl.providerList, values, options);
    },
    updateProvider(values: UpdateProviderParams, options?: RequestOptions) {
      return client.put<ProviderListItem>(RequestUrl.providerList, values, options);
    },
    deleteProvider(id: string, options?: RequestOptions) {
      return client.delete<null>(buildApiUrl(RequestUrl.providerDetail, { id }), undefined, options);
    },
  };
}
