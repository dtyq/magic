import { createContext, useContext } from "react";
import { apiEndpoints } from "@magic-admin-v2/api/api-url";

export type ProviderModelPermissionScope = "platform" | "workspace";

export type ProviderModelDataSource = {
  key: string;
  permissionScope: ProviderModelPermissionScope;
  supportsLoadBalancing?: boolean;
  endpoints: {
    modelConnectivityTest: string;
    modelConnectivityTestByConfig: string;
    modelCreate: string;
    modelDetail: string;
    modelGroupList: string;
    /** Legacy admin endpoint used to import an existing model configuration by model_id. */
    modelImportList?: string;
    modelOriginalIdCreate: string;
    modelOriginalIdDelete: string;
    modelOriginalIds: string;
    modelPricingTemplates?: string;
    modelStatus: string;
    providerList: string;
  };
};

export const platformProviderModelDataSource: ProviderModelDataSource = {
  key: "platform",
  permissionScope: "platform",
  supportsLoadBalancing: true,
  endpoints: {
    modelConnectivityTest: apiEndpoints.providerModelConnectivityTest,
    modelConnectivityTestByConfig: apiEndpoints.providerModelConnectivityTestByConfig,
    modelCreate: apiEndpoints.providerModelCreate,
    modelDetail: apiEndpoints.providerModelDetail,
    modelGroupList: apiEndpoints.providerModelGroupList,
    modelImportList: apiEndpoints.packageAllModels,
    modelOriginalIdCreate: apiEndpoints.providerOriginalModelIdCreate,
    modelOriginalIdDelete: apiEndpoints.providerOriginalModelIdDelete,
    modelOriginalIds: apiEndpoints.providerOriginalModelIds,
    modelPricingTemplates: apiEndpoints.providerModelPricingTemplates,
    modelStatus: apiEndpoints.providerModelStatus,
    providerList: apiEndpoints.providerList,
  },
};

export const ProviderModelDataSourceContext = createContext<ProviderModelDataSource>(
  platformProviderModelDataSource,
);

export function useProviderModelDataSource() {
  return useContext(ProviderModelDataSourceContext);
}
