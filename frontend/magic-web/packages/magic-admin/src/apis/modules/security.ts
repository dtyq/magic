import { RequestUrl } from "../constant"
import type { HttpClient } from "@admin/apis/core/HttpClient"

export const generateSecurityApi = (client: HttpClient) => {
	return {
		/* 获取我的权限列表 */
		getMyPermissionList() {
			return client.get<{ permission_key: string[] }>(RequestUrl.getMyPermissionList)
		},
	}
}
