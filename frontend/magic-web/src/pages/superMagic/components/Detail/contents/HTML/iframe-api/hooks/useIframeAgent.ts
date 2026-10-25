/**
 * useIframeAgent
 *
 * 管理 IframeAgentService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。
 */

import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { IframeAgentService, type IframeAgentConfig } from "../services/IframeAgentService"
import type { AgentInfo, HtmlPermissionScope, TiptapJSONContent } from "../types"

export interface UseIframeAgentOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 回发 iframe 的严格目标源。 */
	targetOrigin: string
	/** 获取当前 Agent 列表的函数 */
	getAgentList: () => AgentInfo[]
	/** 发送消息。单话题宿主发到当前话题，并忽略 agentId。 */
	createTopicAndSend: (params: {
		message: string | TiptapJSONContent
		agentId?: string
		model?: string
	}) => Promise<{ topicId: string }>
	/** 在当前话题发送消息 */
	sendMessage: (params: { message: string | TiptapJSONContent; model?: string }) => Promise<void>
	/**
	 * 是否允许 iframe 执行写操作（createTopicAndSend / sendMessage）。
	 * 默认 false，仅开放只读能力。
	 */
	enableWriteOperations?: boolean
	/** 当前项目 ID；缺失时项目相关写操作不可用。 */
	projectId?: string
	/** 项目上下文不可用时返回给 iframe 的语义化错误。 */
	projectContextUnavailableError?: string
	/** 执行高风险能力前的授权检查。 */
	authorizePermission?: (scope: HtmlPermissionScope) => Promise<boolean>
}

export interface UseIframeAgentReturn {
	/** 分发 MAGIC_*_AGENTS_* / MAGIC_*_TOPIC_* / MAGIC_SEND_MESSAGE_* 消息，返回 true 表示已处理 */
	handleAgentMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeAgent(options: UseIframeAgentOptions): UseIframeAgentReturn {
	const {
		iframeRef,
		targetOrigin,
		getAgentList,
		createTopicAndSend,
		sendMessage,
		enableWriteOperations = false,
		projectId,
		projectContextUnavailableError,
		authorizePermission,
	} = options

	const serviceRef = useRef<IframeAgentService | null>(null)

	const postToIframe = useMemoizedFn((message: object) => {
		iframeRef.current?.contentWindow?.postMessage(message, targetOrigin)
	})

	useEffect(() => {
		const cfg: IframeAgentConfig = {
			postToIframe,
			getAgentList,
			createTopicAndSend,
			sendMessage,
			enableWriteOperations,
			projectId,
			projectContextUnavailableError,
			authorizePermission,
		}

		serviceRef.current = new IframeAgentService(cfg)

		return () => {
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [
		postToIframe,
		getAgentList,
		createTopicAndSend,
		sendMessage,
		enableWriteOperations,
		projectId,
		projectContextUnavailableError,
		authorizePermission,
	])

	const handleAgentMessage = useMemoizedFn(
		async (type: string, payload: unknown): Promise<boolean> => {
			if (!serviceRef.current) return false
			return serviceRef.current.handleMessage(type, payload)
		},
	)

	return { handleAgentMessage }
}
