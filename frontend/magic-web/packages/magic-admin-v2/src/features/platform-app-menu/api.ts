import { RequestUrl } from "@magic-admin-v2/api/constants";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import {
  appMenuDisplayScope,
  appMenuIconType,
  appMenuOpenMethod,
  appMenuStatus,
  type AppMenuFormState,
  type AppMenuItem,
  type AppMenuListParams,
  type AppMenuPageResult,
  type AppMenuSaveParams,
  type AppMenuStatus,
} from "@magic-admin-v2/features/platform-app-menu/types";

export function createEmptyAppMenuFormState(): AppMenuFormState {
  return {
    name_i18n: {
      zh_CN: "",
      en_US: "",
    },
    icon_type: appMenuIconType.icon,
    icon: "IconSuperMagic",
    icon_url: "",
    path: "",
    open_method: appMenuOpenMethod.self,
    sort_order: 0,
    display_scope: appMenuDisplayScope.all,
    status: true,
  };
}

export function toAppMenuFormState(item: AppMenuItem): AppMenuFormState {
  return {
    name_i18n: {
      zh_CN: item.name_i18n?.zh_CN ?? "",
      en_US: item.name_i18n?.en_US ?? "",
    },
    icon_type: item.icon_type ?? appMenuIconType.icon,
    icon: item.icon ?? "IconSuperMagic",
    icon_url: item.icon_url ?? "",
    path: item.path ?? "",
    open_method: item.open_method ?? appMenuOpenMethod.self,
    sort_order: item.sort_order ?? 0,
    display_scope: item.display_scope ?? appMenuDisplayScope.all,
    status: item.status === appMenuStatus.enabled,
  };
}

export function toAppMenuSaveParams(
  values: AppMenuFormState,
  id?: string,
): AppMenuSaveParams {
  const isIconMode = values.icon_type === appMenuIconType.icon;

  return {
    id,
    name_i18n: {
      zh_CN: values.name_i18n.zh_CN.trim(),
      en_US: values.name_i18n.en_US.trim(),
    },
    icon_type: values.icon_type,
    icon: isIconMode ? values.icon : undefined,
    icon_url: isIconMode ? undefined : values.icon_url.trim(),
    path: values.path.trim(),
    open_method: values.open_method,
    sort_order: values.sort_order,
    display_scope: values.display_scope,
    status: values.status ? appMenuStatus.enabled : appMenuStatus.disabled,
  };
}

export function createAppMenuApi(client: HttpClient) {
  return {
    getAppMenuList(params: AppMenuListParams, options?: RequestOptions) {
      return client.post<AppMenuPageResult>(RequestUrl.appMenuList, params, options);
    },
    getAppMenuDetail(id: string, options?: RequestOptions) {
      return client.get<AppMenuItem>(buildApiUrl(RequestUrl.appMenuDetail, { id }), options);
    },
    saveAppMenu(values: AppMenuFormState, id?: string, options?: RequestOptions) {
      return client.post<AppMenuItem>(
        RequestUrl.appMenuSave,
        toAppMenuSaveParams(values, id),
        options,
      );
    },
    deleteAppMenu(id: string, options?: RequestOptions) {
      return client.post<boolean>(RequestUrl.appMenuDelete, { id }, options);
    },
    updateAppMenuStatus(id: string, status: AppMenuStatus, options?: RequestOptions) {
      return client.post<AppMenuItem>(RequestUrl.appMenuStatus, { id, status }, options);
    },
  };
}
