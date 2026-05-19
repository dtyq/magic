import type { RequestConfig } from "@/apis/core/HttpClient"

export interface ThirdPartyLoginStrategy {
	getAuthCode(
		deployCode?: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<string> // 返回用户凭证或用户ID
}
