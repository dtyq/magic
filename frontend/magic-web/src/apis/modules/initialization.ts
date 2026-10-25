import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type {
	InitializationData,
	LLMConnectivityTestRequest,
	LLMConnectivityTestResponse,
} from "../types"

export const generateInitializationApi = (fetch: ServiceHttpClient) => ({
	/**
	 * 提交初始化配置
	 * @param data 包含三个步骤的完整初始化数据
	 */
	submitInitialization(data: InitializationData) {
		return fetch.post<{ success: boolean }>("/api/v1/bootstrap", data)
	},

	/**
	 * 测试 LLM 服务提供商连接
	 * @param data LLM 连接测试请求数据
	 */
	testLLMConnectivity(data: LLMConnectivityTestRequest) {
		return fetch.post<LLMConnectivityTestResponse>(
			"/api/v1/bootstrap/llm/connectivity-test",
			data,
			{
				enableAuthorizationVerification: false,
			},
		)
	},
})
