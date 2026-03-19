import { genRequestUrl } from "@/utils/http"
import type { HttpClient } from "../core/HttpClient"
import type {
	InitializationData,
	LLMConnectivityTestRequest,
	LLMConnectivityTestResponse,
} from "../types"

export const generateInitializationApi = (fetch: HttpClient) => ({
	/**
	 * 提交初始化配置
	 * @param data 包含三个步骤的完整初始化数据
	 */
	submitInitialization(data: InitializationData) {
		return fetch.post<{ success: boolean }>(genRequestUrl("/api/v1/bootstrap"), data)
	},

	/**
	 * 测试 LLM 服务提供商连接
	 * @param data LLM 连接测试请求数据
	 */
	testLLMConnectivity(data: LLMConnectivityTestRequest) {
		return fetch.post<LLMConnectivityTestResponse>(
			genRequestUrl("/api/v1/bootstrap/llm/connectivity-test"),
			data,
			{
				enableAuthorizationVerification: false,
			},
		)
	},
})
