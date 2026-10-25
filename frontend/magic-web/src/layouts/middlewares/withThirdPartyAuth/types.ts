import type { RequestConfig } from "@/infrastructure/network/http/clients"

export interface ThirdPartyLoginStrategy {
	getAuthCode(
		deployCode?: string,
		options?: Pick<RequestConfig, "skipAppInitWait">,
	): Promise<string> // 返回用户凭证或用户ID
}
