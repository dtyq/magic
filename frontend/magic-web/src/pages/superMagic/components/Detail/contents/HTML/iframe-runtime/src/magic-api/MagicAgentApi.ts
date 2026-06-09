/**
 * MagicAgentApi
 *
 * 向 iframe 内注入 Agent 交互扩展 API：
 *   - window.Magic.agent.getAgents()           — 获取当前可用的员工（Agent）列表
 *   - window.Magic.project.createTopicAndSend() — 新建话题并发送消息
 *   - window.Magic.project.sendMessage()        — 在当前话题发送消息
 *
 * 向后兼容（deprecated）：
 *   - window.Magic.getAgents()
 *   - window.Magic.createTopicAndSend()
 *   - window.Magic.sendMessage()
 *
 * 所有操作通过 postMessage 委托给主站（parent window）处理。
 */

import { MagicBaseApi } from "./MagicBaseApi"
import { MagicApiLogger } from "./MagicApiLogger"

export interface AgentInfo {
    /** Agent 唯一标识 (mode.identifier) */
    id: string
    /** Agent 名称 */
    name: string
    /** Agent 图标 URL */
    icon: string
    /** Agent 图标颜色 */
    color: string
    /** Agent 类型: official / custom / public */
    type: "official" | "custom" | "public"
}

export interface CreateTopicAndSendOptions {
    /** 指定 Agent ID (mode.identifier) */
    agentId?: string
    /** 指定模型 ID */
    model?: string
}

/** Tiptap JSON 文档结构，可内联 mention 等富文本节点 */
export interface TiptapJSONContent {
    type: string
    attrs?: Record<string, unknown>
    content?: TiptapJSONContent[]
    text?: string
    [key: string]: unknown
}

export interface SendMessageOptions {
    /** 指定模型 ID */
    model?: string
}

export class MagicAgentApi extends MagicBaseApi {
    install(): void {
        if (!window.Magic) window.Magic = {}
        if (!window.Magic.agent) window.Magic.agent = {}
        if (!window.Magic.project) window.Magic.project = {}
        MagicApiLogger.info("MagicAgentApi", "install")
        this.installGetAgents()
        this.installCreateTopicAndSend()
        this.installSendMessage()
    }

    private installGetAgents(): void {
        const getAgentsFn = (): Promise<AgentInfo[]> => {
            MagicApiLogger.info("MagicAgentApi", "getAgents:start")
            return this.request<AgentInfo[]>(
                "MAGIC_GET_AGENTS_REQUEST",
                {},
                15000,
                (data) => (data["agents"] as AgentInfo[]) ?? [],
            )
        }

        // New namespace
        if (!window.Magic.agent!.getAgents) {
            window.Magic.agent!.getAgents = getAgentsFn
        }
        // Backward compat (deprecated)
        if (!window.Magic.getAgents) {
            window.Magic.getAgents = getAgentsFn
        }
    }

    private installCreateTopicAndSend(): void {
        const createTopicAndSendFn = (
            message: string | TiptapJSONContent,
            options?: CreateTopicAndSendOptions,
        ): Promise<{ topicId: string }> => {
            if (typeof message === "string") {
                if (!message.trim()) {
                    return Promise.reject(
                        new Error("createTopicAndSend: message must be a non-empty string"),
                    )
                }
            } else if (!message || typeof message !== "object" || !message.type) {
                return Promise.reject(
                    new Error("createTopicAndSend: message must be a non-empty string or a valid tiptap JSON object"),
                )
            }
            MagicApiLogger.info("MagicAgentApi", "createTopicAndSend:start", {
                message: typeof message === "string" ? MagicApiLogger.summarizeText(message) : "[TiptapJSON]",
                agentId: options?.agentId,
                model: options?.model,
            })
            return this.request<{ topicId: string }>(
                "MAGIC_CREATE_TOPIC_AND_SEND_REQUEST",
                {
                    message,
                    agentId: options?.agentId,
                    model: options?.model,
                },
                30000,
                (data) => ({ topicId: (data["topicId"] as string) ?? "" }),
            )
        }

        // New namespace
        if (!window.Magic.project!.createTopicAndSend) {
            window.Magic.project!.createTopicAndSend = createTopicAndSendFn
        }
        // Backward compat (deprecated)
        if (!window.Magic.createTopicAndSend) {
            window.Magic.createTopicAndSend = createTopicAndSendFn
        }
    }

    private installSendMessage(): void {
        const sendMessageFn = (
            message: string | TiptapJSONContent,
            options?: SendMessageOptions,
        ): Promise<void> => {
            if (typeof message === "string") {
                if (!message.trim()) {
                    return Promise.reject(
                        new Error("sendMessage: message must be a non-empty string"),
                    )
                }
            } else if (!message || typeof message !== "object" || !message.type) {
                return Promise.reject(
                    new Error("sendMessage: message must be a non-empty string or a valid tiptap JSON object"),
                )
            }
            MagicApiLogger.info("MagicAgentApi", "sendMessage:start", {
                message: typeof message === "string" ? MagicApiLogger.summarizeText(message) : "[TiptapJSON]",
                model: options?.model,
            })
            return this.request<void>(
                "MAGIC_SEND_MESSAGE_REQUEST",
                {
                    message,
                    model: options?.model,
                },
                15000,
                () => undefined,
            )
        }

        // New namespace
        if (!window.Magic.project!.sendMessage) {
            window.Magic.project!.sendMessage = sendMessageFn
        }
        // Backward compat (deprecated)
        if (!window.Magic.sendMessage) {
            window.Magic.sendMessage = sendMessageFn
        }
    }
}
