import { RequestUrl } from "@magic-admin-v2/api/constants";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import type {
  AgentMarketCategoryListParams,
  AgentMarketCategoryListResult,
  AgentMarketCategoryItem,
  AgentMarketItem,
  AgentMarketListParams,
  ImportOfficialSkillResponse,
  OfficialSkillImportParams,
  ParseOfficialSkillResponse,
  SaveSkillMarketCategoryParams,
  SkillMarketCategoryItem,
  SkillMarketCategoryListParams,
  SkillMarketCategoryListResult,
  SaveAgentMarketCategoryParams,
  SkillMarketItem,
  SkillMarketListParams,
  UpdateAgentMarketCategoryRelationParams,
  UpdateSkillMarketCategoryRelationParams,
  UpdateMarketInfoParams,
  WithPage,
} from "@magic-admin-v2/features/platform-official-marketplace/types";

export function createPlatformOfficialMarketplaceApi(client: HttpClient) {
  return {
    getAgentMarketList(params: AgentMarketListParams, options?: RequestOptions) {
      return client.post<WithPage<AgentMarketItem>>(RequestUrl.agentMarketList, params, options);
    },
    getAgentMarketCategoryList(
      params: AgentMarketCategoryListParams,
      options?: RequestOptions,
    ) {
      return client.post<AgentMarketCategoryListResult>(
        RequestUrl.agentMarketCategoryList,
        params,
        options,
      );
    },
    getAgentMarketCategoryDetail(id: string, options?: RequestOptions) {
      return client.get<AgentMarketCategoryItem>(
        buildApiUrl(RequestUrl.agentMarketCategoryDetail, { id }),
        options,
      );
    },
    createAgentMarketCategory(
      values: SaveAgentMarketCategoryParams,
      options?: RequestOptions,
    ) {
      return client.post<AgentMarketCategoryItem>(
        RequestUrl.agentMarketCategoryCreate,
        values,
        options,
      );
    },
    updateAgentMarketCategory(
      id: string,
      values: SaveAgentMarketCategoryParams,
      options?: RequestOptions,
    ) {
      return client.put<AgentMarketCategoryItem>(
        buildApiUrl(RequestUrl.agentMarketCategoryDetail, { id }),
        values,
        options,
      );
    },
    deleteAgentMarketCategory(id: string, options?: RequestOptions) {
      return client.delete<null>(
        buildApiUrl(RequestUrl.agentMarketCategoryDetail, { id }),
        undefined,
        options,
      );
    },
    getSkillMarketList(params: SkillMarketListParams, options?: RequestOptions) {
      return client.post<WithPage<SkillMarketItem>>(RequestUrl.skillMarketList, params, options);
    },
    getSkillMarketCategoryList(
      params: SkillMarketCategoryListParams,
      options?: RequestOptions,
    ) {
      return client.post<SkillMarketCategoryListResult>(
        RequestUrl.skillMarketCategoryList,
        params,
        options,
      );
    },
    getSkillMarketCategoryDetail(id: string, options?: RequestOptions) {
      return client.get<SkillMarketCategoryItem>(
        buildApiUrl(RequestUrl.skillMarketCategoryDetail, { id }),
        options,
      );
    },
    createSkillMarketCategory(values: SaveSkillMarketCategoryParams, options?: RequestOptions) {
      return client.post<SkillMarketCategoryItem>(
        RequestUrl.skillMarketCategoryCreate,
        values,
        options,
      );
    },
    updateSkillMarketCategory(
      id: string,
      values: SaveSkillMarketCategoryParams,
      options?: RequestOptions,
    ) {
      return client.put<SkillMarketCategoryItem>(
        buildApiUrl(RequestUrl.skillMarketCategoryDetail, { id }),
        values,
        options,
      );
    },
    deleteSkillMarketCategory(id: string, options?: RequestOptions) {
      return client.delete<null>(
        buildApiUrl(RequestUrl.skillMarketCategoryDetail, { id }),
        undefined,
        options,
      );
    },
    updateSkillMarketCategoryRelation(
      id: string,
      categoryIds: string[],
      options?: RequestOptions,
    ) {
      const values: UpdateSkillMarketCategoryRelationParams = { category_ids: categoryIds };
      return client.put<null>(
        buildApiUrl(RequestUrl.skillMarketCategoryRelation, { id }),
        values,
        options,
      );
    },
    parseOfficialSkillFile(values: { file_key: string }, options?: RequestOptions) {
      return client.post<ParseOfficialSkillResponse>(
        RequestUrl.parseOfficialSkillFile,
        values,
        options,
      );
    },
    importOfficialSkill(values: OfficialSkillImportParams, options?: RequestOptions) {
      return client.post<ImportOfficialSkillResponse>(
        RequestUrl.importOfficialSkill,
        values,
        options,
      );
    },
    updateAgentMarketInfo(
      id: string,
      values: UpdateMarketInfoParams,
      options?: RequestOptions,
    ) {
      return client.put<null>(buildApiUrl(RequestUrl.agentMarketDetail, { id }), values, options);
    },
    updateAgentMarketCategoryRelation(
      id: string,
      categoryIds: string[],
      options?: RequestOptions,
    ) {
      const values: UpdateAgentMarketCategoryRelationParams = { category_ids: categoryIds };
      return client.put<null>(
        buildApiUrl(RequestUrl.agentMarketCategoryRelation, { id }),
        values,
        options,
      );
    },
    updateSkillMarketInfo(
      id: string,
      values: UpdateMarketInfoParams,
      options?: RequestOptions,
    ) {
      return client.put<null>(buildApiUrl(RequestUrl.skillMarketDetail, { id }), values, options);
    },
  };
}
