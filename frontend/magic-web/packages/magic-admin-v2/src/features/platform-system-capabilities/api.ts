import { RequestUrl } from "@magic-admin-v2/api/constants"
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types"
import { buildApiUrl } from "@magic-admin-v2/api/api-url"
import {
	type AiPower,
	type AiPowerDetail,
	type CapabilityModel,
	type TestAiPowerConnectionParams,
	type TestAiPowerConnectionResult,
	type UpdateAiPowerParams,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import { IMAGE_TOOL_CODES } from "@magic-admin-v2/features/platform-system-capabilities/consts"

export function createPlatformSystemCapabilitiesApi(client: HttpClient) {
	return {
		getSystemCapabilityList(options?: RequestOptions) {
			return client.get<AiPower[]>(RequestUrl.aiPowerList, options)
		},
		getSystemCapabilityDetail(code: string, options?: RequestOptions) {
			return client.get<AiPowerDetail>(
				buildApiUrl(RequestUrl.aiPowerDetail, { code }),
				options,
			)
		},
		updateSystemCapability(params: UpdateAiPowerParams, options?: RequestOptions) {
			return client.put<AiPower>(
				buildApiUrl(RequestUrl.aiPowerDetail, { code: params.code }),
				params,
				options,
			)
		},
		testSystemCapabilityConnection(
			params: TestAiPowerConnectionParams,
			options?: RequestOptions,
		) {
			return client.post<TestAiPowerConnectionResult>(
				RequestUrl.aiPowerConnectivityTest,
				params,
				options,
			)
		},
		getCapabilityModels(code: string, options?: RequestOptions) {
			return client.post<CapabilityModel[]>(
				RequestUrl.packageAllModels,
				{
					category: IMAGE_TOOL_CODES.some((item) => item === code) ? "vlm" : "llm",
					is_model_id_filter: true,
					status: 1,
				},
				options,
			)
		},
	}
}
