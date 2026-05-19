/**
 * useIframeLLM
 *
 * 管理 IframeLLMService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。
 */

import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { IframeLLMService, type IframeLLMConfig } from "../services/IframeLLMService"

export interface UseIframeLLMOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** Magic 主站 API 基地址 */
	baseUrl: string
	/** 获取当前用户 authorization 的函数 */
	getAuthorization: () => string
	/** 获取当前组织代码的函数 */
	getOrganizationCode: () => string
}

export interface UseIframeLLMReturn {
	/** 分发 MAGIC_LLM_* 消息，返回 true 表示已处理 */
	handleLLMMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeLLM(options: UseIframeLLMOptions): UseIframeLLMReturn {
	const { iframeRef, baseUrl, getAuthorization, getOrganizationCode } = options

	const serviceRef = useRef<IframeLLMService | null>(null)

	const postToIframe = useMemoizedFn((message: object) => {
		iframeRef.current?.contentWindow?.postMessage(message, "*")
	})

	useEffect(() => {
		const cfg: IframeLLMConfig = {
			postToIframe,
			baseUrl,
			getAuthorization,
			getOrganizationCode,
		}

		serviceRef.current = new IframeLLMService(cfg)

		return () => {
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [baseUrl, getAuthorization, getOrganizationCode, postToIframe])

	const handleLLMMessage = useMemoizedFn(
		async (type: string, payload: unknown): Promise<boolean> => {
			if (!serviceRef.current) return false
			return serviceRef.current.handleMessage(type, payload)
		},
	)

	return { handleLLMMessage }
}
