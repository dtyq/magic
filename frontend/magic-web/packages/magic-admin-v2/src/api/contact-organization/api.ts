import { buildApiUrl } from "@magic-admin-v2/api/api-url";
import { RequestUrl } from "@magic-admin-v2/api/constants";
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types";
import type {
  ContactDepartment,
  ContactDepartmentChildrenParams,
  ContactDepartmentUsersParams,
  ContactTokenPage,
  ContactUser,
  ContactUserSearchParams,
} from "./types";

/** Magic 联系人接口由公共 API 统一声明，业务模块只消费该命名空间。 */
export function createContactOrganizationApi(client: HttpClient) {
  return {
    getDepartmentChildren(
      {
        departmentId = "-1",
        pageToken,
        sumType = 2,
      }: ContactDepartmentChildrenParams = {},
      options?: RequestOptions,
    ) {
      return client.get<ContactTokenPage<ContactDepartment>>(
        buildApiUrl(
          RequestUrl.contactDepartmentChildren,
          { id: departmentId || "-1" },
          { page_token: pageToken, sum_type: sumType },
        ),
        options,
      );
    },
    getDepartmentUsers(
      {
        count = 50,
        departmentId = "-1",
        isRecursive = 0,
        pageToken = "",
      }: ContactDepartmentUsersParams = {},
      options?: RequestOptions,
    ) {
      return client.get<ContactTokenPage<ContactUser>>(
        buildApiUrl(
          RequestUrl.contactDepartmentUsers,
          { id: departmentId || "-1" },
          { count, is_recursive: isRecursive, page_token: pageToken },
        ),
        options,
      );
    },
    searchUsers(
      { pageToken, query, queryType = 1 }: ContactUserSearchParams,
      options?: RequestOptions,
    ) {
      return client.get<ContactTokenPage<ContactUser>>(
        buildApiUrl(
          RequestUrl.contactUserSearch,
          undefined,
          { page_token: pageToken, query, query_type: queryType },
        ),
        options,
      );
    },
  };
}

export type ContactOrganizationApi = ReturnType<typeof createContactOrganizationApi>;
