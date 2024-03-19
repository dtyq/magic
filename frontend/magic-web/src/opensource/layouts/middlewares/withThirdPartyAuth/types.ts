export interface ThirdPartyLoginStrategy {
	getAuthCode(deployCode?: string): Promise<string> // 返回用户凭证或用户ID
}
