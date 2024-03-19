import type { PlatformInfo } from "@/types/platformInfo"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generatePlatformInfoApi = (client: HttpClient) => {
	return {
		/** 获取平台信息 */
		getPlatformInfo() {
			return client.get<PlatformInfo.Details>(RequestUrl.getPlatformInfo)
		},

		/** 修改平台信息 */
		updatePlatformInfo(data: PlatformInfo.UpdateParams) {
			return client.put<null>(RequestUrl.updatePlatformInfo, data)
		},
	}
}
