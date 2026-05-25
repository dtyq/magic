/**
 * useIframeAgent
 *
 * 管理 IframeAgentService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。
 */

import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { IframeAgentService, type IframeAgentConfig } from "../services/IframeAgentService"
import type { AgentInfo, TiptapJSONContent } from "../types"

export interface UseIframeAgentOptions {
    /** iframe ref，用于构造 postToIframe */
    iframeRef: React.RefObject<HTMLIFrameElement>
    /** 获取当前 Agent 列表的函数 */
    getAgentList: () => AgentInfo[]
    /** 创建话题并发送消息 */
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
}

export interface UseIframeAgentReturn {
    /** 分发 MAGIC_*_AGENTS_* / MAGIC_*_TOPIC_* / MAGIC_SEND_MESSAGE_* 消息，返回 true 表示已处理 */
    handleAgentMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeAgent(options: UseIframeAgentOptions): UseIframeAgentReturn {
    const { iframeRef, getAgentList, createTopicAndSend, sendMessage, enableWriteOperations = false } = options

    const serviceRef = useRef<IframeAgentService | null>(null)

    const postToIframe = useMemoizedFn((message: object) => {
        iframeRef.current?.contentWindow?.postMessage(message, "*")
    })

    useEffect(() => {
        const cfg: IframeAgentConfig = {
            postToIframe,
            getAgentList,
            createTopicAndSend,
            sendMessage,
            enableWriteOperations,
        }

        serviceRef.current = new IframeAgentService(cfg)

        return () => {
            serviceRef.current?.destroy()
            serviceRef.current = null
        }
    }, [postToIframe, getAgentList, createTopicAndSend, sendMessage, enableWriteOperations])

    const handleAgentMessage = useMemoizedFn(
        async (type: string, payload: unknown): Promise<boolean> => {
            if (!serviceRef.current) return false
            return serviceRef.current.handleMessage(type, payload)
        },
    )

    return { handleAgentMessage }
}
