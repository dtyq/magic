import { toModelMultiplierUpdate } from "../../../../model-billing-reference"
import type { PlatformInfo } from "@admin/types/platformInfo"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generatePlatformInfoApi = (client: HttpClient) => {
	return {
		/** 获取平台信息 */
		getPlatformInfo() {
			return client.get<PlatformInfo.Details>(RequestUrl.getPlatformInfo)
		},

		/** 修改平台信息 */
		updatePlatformInfo(data: Partial<PlatformInfo.UpdateParams>) {
			return client.put<PlatformInfo.Details>(RequestUrl.updatePlatformInfo, {
				...data,
				...(data.model_billing_multiplier
					? {
							model_billing_multiplier: toModelMultiplierUpdate(
								data.model_billing_multiplier,
							),
						}
					: {}),
			})
		},
	}
}
