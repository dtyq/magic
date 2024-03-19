import { FlowApi } from "@/opensource/apis"
import { generateCallbackUrl } from "@/opensource/components/Agent/MCP/helpers"
import { openAgentCommonModal } from "@/opensource/components/Agent/AgentCommonModal"
import MCPOAuth from "../../../MCPOAuth"

export const enum MCPOAuthType {
	/** Verification successful */
	successful,
	/** No verification required */
	noVerificationRequired,
	/** Verification failed */
	validationFailed,
}

/**
 * @description Check MCP status
 * @param {IMCPItem} item
 */
export function checkMCPOAuth(item: {
	id: string
	require_fields?: { field_name?: string; field_value?: string }[]
}): Promise<MCPOAuthType> {
	return FlowApi.getMCPUserSettings({
		code: item?.id,
		redirectUrl: generateCallbackUrl(),
	}).then(async (data) => {
		try {
			if (data?.auth_type || (item?.require_fields && item?.require_fields?.length > 0)) {
				// Authorization required. Launch a new popup based on the returned form fields for user input.
				// After completion, poll the results in the form popup. Upon success, show success in the popup form,
				// then close the popup form and allow the user to add again
				await new Promise((resolve, reject) => {
					openAgentCommonModal({
						width: 560,
						footer: null,
						closable: false,
						centered: false,
						isResponsive: false,
						onClose: () => reject(MCPOAuthType.validationFailed),
						children: (
							<MCPOAuth
								id={item?.id}
								onEnable={() => resolve(MCPOAuthType.successful)}
							/>
						),
					})
				})

				return MCPOAuthType.successful
			} else {
				return MCPOAuthType.noVerificationRequired
			}
		} catch (error) {
			console.error(error)
			return MCPOAuthType.validationFailed
		}
	})
}
