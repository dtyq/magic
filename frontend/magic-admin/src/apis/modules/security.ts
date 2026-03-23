import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateSecurityApi = (client: HttpClient) => {
	return {
		getMyPermissionList() {
			return client.get<{ permission_key: string[] }>(RequestUrl.getMyPermissionList)
		},
	}
}
