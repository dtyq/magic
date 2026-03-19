/** MCP 授权回调地址 */
export function generateCallbackUrl() {
	return window.location.origin + `/auth/callback/mcp`
}
