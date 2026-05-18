/**
 * MagicAgentApi
 *
 * 向 iframe 内注入 Agent 交互扩展 API：
 *   - window.Magic.getAgents()              — 获取当前可用的员工（Agent）列表
 *   - window.Magic.createTopicAndSend()     — 新建话题并发送消息
 *   - window.Magic.sendMessage()            — 在当前话题发送消息
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

export interface SendMessageOptions {
    /** 指定模型 ID */
    model?: string
}

export class MagicAgentApi extends MagicBaseApi {
    install(): void {
        if (!window.Magic) window.Magic = {}
        MagicApiLogger.info("MagicAgentApi", "install")
        this.installGetAgents()
        this.installCreateTopicAndSend()
        this.installSendMessage()
    }

    private installGetAgents(): void {
        if (window.Magic.getAgents) return

        window.Magic.getAgents = (): Promise<AgentInfo[]> => {
            MagicApiLogger.info("MagicAgentApi", "getAgents:start")
            return this.request<AgentInfo[]>(
                "MAGIC_GET_AGENTS_REQUEST",
                {},
                15000,
                (data) => (data["agents"] as AgentInfo[]) ?? [],
            )
        }
    }

    private installCreateTopicAndSend(): void {
        if (window.Magic.createTopicAndSend) return

        window.Magic.createTopicAndSend = (
            message: string,
            options?: CreateTopicAndSendOptions,
        ): Promise<{ topicId: string }> => {
            if (typeof message !== "string" || !message.trim()) {
                return Promise.reject(
                    new Error("window.Magic.createTopicAndSend: message must be a non-empty string"),
                )
            }
            MagicApiLogger.info("MagicAgentApi", "createTopicAndSend:start", {
                message: MagicApiLogger.summarizeText(message),
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
    }

    private installSendMessage(): void {
        if (window.Magic.sendMessage) return

        window.Magic.sendMessage = (
            message: string,
            options?: SendMessageOptions,
        ): Promise<void> => {
            if (typeof message !== "string" || !message.trim()) {
                return Promise.reject(
                    new Error("window.Magic.sendMessage: message must be a non-empty string"),
                )
            }
            MagicApiLogger.info("MagicAgentApi", "sendMessage:start", {
                message: MagicApiLogger.summarizeText(message),
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
    }
}
