/**
 * MagicContextApi
 *
 * Exposes host-provided context to HTML micro-apps. Sensitive credentials stay
 * in the parent window; the iframe receives only normalized context data.
 */

import { BaseRuntimeBridgeApiPlugin } from "@dtyq/html-sandbox"

export interface MagicContextUser {
	user_id: string
	magic_id?: string
	organization_code?: string
	nickname?: string
	real_name?: string
	avatar_url?: string
	phone?: string
	email?: string | null
	job_title?: string
	path_nodes?: unknown[]
}

export interface MagicContext {
	userId: string
	userName: string
	user: MagicContextUser
	organizationCode: string
	language: string
}

export class MagicContextApi extends BaseRuntimeBridgeApiPlugin {
	constructor() {
		super("MagicContextApi")
	}

	install(): void {
		if (!window.Magic) window.Magic = {}

		const requestContext = (): Promise<MagicContext> => {
			return this.request<MagicContext>("MAGIC_CONTEXT_GET_REQUEST", {}, 15000, (data) => {
				const content = data["content"]
				if (!content || typeof content !== "object") {
					throw new Error("getContext: invalid context response")
				}
				return content as MagicContext
			})
		}

		const getContextFn = window.Magic.getContext ?? requestContext

		if (!window.Magic.getContext) {
			window.Magic.getContext = getContextFn
		}

		window.Magic.context = {
			...window.Magic.context,
			getContext: window.Magic.context?.getContext ?? getContextFn,
		}
	}
}
