/**
 * useIframeLLM
 *
 * 管理 IframeLLMService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。
 */

import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { IframeLLMService, type IframeLLMConfig } from "../services/IframeLLMService"
import type { HtmlPermissionScope } from "../types"

export interface UseIframeLLMOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 回发 iframe 的严格目标源。 */
	targetOrigin: string
	/** Recreate document-owned watches/streams when the iframe Window changes. */
	runtimeRevision?: string | number
	/** Magic 主站 API 基地址 */
	baseUrl: string
	/** 获取当前用户 authorization 的函数 */
	getAuthorization: () => string
	/** 获取当前组织代码的函数 */
	getOrganizationCode: () => string
	/** 执行高风险能力前的授权检查。 */
	authorizePermission?: (scope: HtmlPermissionScope) => Promise<boolean>
}

export interface UseIframeLLMReturn {
	/** 分发 MAGIC_LLM_* 消息，返回 true 表示已处理 */
	handleLLMMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeLLM(options: UseIframeLLMOptions): UseIframeLLMReturn {
	const {
		iframeRef,
		targetOrigin,
		runtimeRevision = 0,
		baseUrl,
		getAuthorization,
		getOrganizationCode,
		authorizePermission,
	} = options

	const serviceRef = useRef<IframeLLMService | null>(null)
	// Inline host callbacks change on ordinary renders. Keep their delegates live
	// without destroying requests; actual account changes still invalidate tokens.
	const authorization = getAuthorization()
	const organizationCode = getOrganizationCode()
	const currentAuthorization = useMemoizedFn(getAuthorization)
	const currentOrganization = useMemoizedFn(getOrganizationCode)
	const currentPermission = useMemoizedFn(async (scope: HtmlPermissionScope) =>
		authorizePermission ? authorizePermission(scope) : true,
	)

	useEffect(() => {
		const target = iframeRef.current?.contentWindow
		let active = true
		const cfg: IframeLLMConfig = {
			postToIframe: (message) => {
				if (active) target?.postMessage(message, targetOrigin)
			},
			baseUrl,
			getAuthorization: currentAuthorization,
			getOrganizationCode: currentOrganization,
			authorizePermission: currentPermission,
		}

		serviceRef.current = new IframeLLMService(cfg)

		return () => {
			active = false
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [
		baseUrl,
		currentAuthorization,
		currentOrganization,
		currentPermission,
		authorization,
		organizationCode,
		iframeRef,
		targetOrigin,
		runtimeRevision,
	])

	const handleLLMMessage = useMemoizedFn(
		async (type: string, payload: unknown): Promise<boolean> => {
			if (!serviceRef.current) return false
			return serviceRef.current.handleMessage(type, payload)
		},
	)

	return { handleLLMMessage }
}
