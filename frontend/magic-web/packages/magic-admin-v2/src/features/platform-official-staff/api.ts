import { RequestUrl } from "@magic-admin-v2/api/constants";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import {
  staffDistributionType,
  type AllModelListParams,
  type DefaultAgentSetting,
  type OfficialStaff,
  type OfficialStaffDetail,
  type OfficialStaffFormState,
  type OfficialStaffGroup,
  type OfficialStaffListParams,
  type OfficialStaffModelOption,
  type SaveOfficialStaffGroupParams,
  type SaveOfficialStaffParams,
  type UpdateOfficialStaffStatusParams,
  type WithPage,
} from "@magic-admin-v2/features/platform-official-staff/types";
import { normalizeDetailForSave, normalizeDetailFromResponse } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-models";

export function createEmptyOfficialStaffFormState(): OfficialStaffFormState {
  return {
    identifier: "",
    name_i18n: {
      zh_CN: "",
      en_US: "",
    },
    organization_whitelist: "",
    placeholder_i18n: {
      zh_CN: "",
      en_US: "",
    },
    sort: 0,
  };
}

export function toOfficialStaffFormState(staff?: OfficialStaff | null): OfficialStaffFormState {
  if (!staff) {
    return createEmptyOfficialStaffFormState();
  }

  return {
    identifier: staff.identifier ?? "",
    name_i18n: {
      zh_CN: staff.name_i18n?.zh_CN || staff.name_i18n?.default || "",
      en_US: staff.name_i18n?.en_US || staff.name_i18n?.default || "",
    },
    organization_whitelist: staff.organization_whitelist ?? "",
    placeholder_i18n: {
      zh_CN: staff.placeholder_i18n?.zh_CN || staff.placeholder_i18n?.default || "",
      en_US: staff.placeholder_i18n?.en_US || staff.placeholder_i18n?.default || "",
    },
    sort: Number(staff.sort ?? 0),
  };
}

export function toSaveOfficialStaffParams(values: OfficialStaffFormState): SaveOfficialStaffParams {
  return {
    ...values,
    description: "",
    organization_whitelist: values.organization_whitelist
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(","),
  };
}

export function createPlatformOfficialStaffApi(client: HttpClient) {
  return {
    getOfficialStaffList(params: OfficialStaffListParams, options?: RequestOptions) {
      return client.get<WithPage<OfficialStaff>>(
        buildApiUrl(RequestUrl.officialStaffList, undefined, params),
        options,
      );
    },
    createOfficialStaff(values: OfficialStaffFormState, options?: RequestOptions) {
      return client.post<OfficialStaff>(
        RequestUrl.officialStaffList,
        toSaveOfficialStaffParams(values),
        options,
      );
    },
    async updateOfficialStaff(
      id: string,
      values: OfficialStaffFormState,
      options?: RequestOptions,
    ) {
      const detail = await client.put<OfficialStaffDetail>(
        buildApiUrl(RequestUrl.officialStaffDetail, { id }),
        toSaveOfficialStaffParams(values),
        options,
      );
      return detail.mode;
    },
    updateOfficialStaffStatus(
      params: UpdateOfficialStaffStatusParams,
      options?: RequestOptions,
    ) {
      return client.put<null>(
        buildApiUrl(RequestUrl.officialStaffStatus, { id: params.id }),
        { status: params.status },
        options,
      );
    },
    getOfficialStaffDetail(id: string, options?: RequestOptions) {
      return client
        .get<OfficialStaffDetail>(buildApiUrl(RequestUrl.officialStaffDetail, { id }), options)
        .then(normalizeDetailFromResponse);
    },
    getDefaultOfficialStaffDetail(options?: RequestOptions) {
      return client.get<OfficialStaffDetail>(RequestUrl.officialStaffDefault, options).then(normalizeDetailFromResponse);
    },
    getDefaultAgentSetting(options?: RequestOptions) {
      return client.get<DefaultAgentSetting>(RequestUrl.officialStaffDefaultAgent, options);
    },
    updateDefaultAgentSetting(
      params: DefaultAgentSetting,
      options?: RequestOptions,
    ) {
      return client.put<DefaultAgentSetting>(
        RequestUrl.officialStaffDefaultAgent,
        params,
        options,
      );
    },
    getOfficialStaffOrigin(id: string, options?: RequestOptions) {
      return client.get<OfficialStaffDetail>(buildApiUrl(RequestUrl.officialStaffOrigin, { id }), options).then(normalizeDetailFromResponse);
    },
    saveOfficialStaffConfig(
      id: string,
      detail: OfficialStaffDetail,
      options?: RequestOptions,
    ) {
      const normalizedDetail = normalizeDetailForSave(detail);
      return client.put<OfficialStaffDetail>(
        buildApiUrl(RequestUrl.officialStaffConfig, { id }),
        {
          mode: {
            ...normalizedDetail.mode,
            distribution_type: normalizedDetail.mode.distribution_type ?? staffDistributionType.independent,
          },
          groups: normalizedDetail.groups,
        },
        options,
      );
    },
    getAllStaffModels(params: AllModelListParams = {}, options?: RequestOptions) {
      return client.post<OfficialStaffModelOption[]>(
        RequestUrl.packageAllModels,
        { is_model_id_filter: true, status: 1, ...params },
        options,
      );
    },
    createOfficialStaffGroup(
      params: SaveOfficialStaffGroupParams,
      options?: RequestOptions,
    ) {
      return client.post<OfficialStaffGroup>(RequestUrl.officialStaffGroupCreate, params, options);
    },
    updateOfficialStaffGroup(
      params: SaveOfficialStaffGroupParams,
      options?: RequestOptions,
    ) {
      return client.put<OfficialStaffGroup>(
        buildApiUrl(RequestUrl.officialStaffGroupDetail, { id: params.id }),
        params,
        options,
      );
    },
    deleteOfficialStaffGroup(id: string, options?: RequestOptions) {
      return client.delete<null>(
        buildApiUrl(RequestUrl.officialStaffGroupDetail, { id }),
        undefined,
        options,
      );
    },
    getOfficialAgentDetail(code: string, options?: RequestOptions) {
      return client.get<OfficialStaff>(
        buildApiUrl(RequestUrl.officialAgentDetail, { code }),
        options,
      );
    },
  };
}
