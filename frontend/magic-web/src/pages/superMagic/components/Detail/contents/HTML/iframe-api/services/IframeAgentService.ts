/**
 * IframeAgentService
 *
 * 处理 MAGIC_GET_AGENTS_*, MAGIC_CREATE_TOPIC_AND_SEND_*, MAGIC_SEND_MESSAGE_* 消息，
 * 为宿主（parent window）提供 Agent 列表获取、话题创建+发送、当前话题发送能力。
 * 纯 class，不依赖 React，由 useIframeAgent hook 持有实例。
 */

import {
    AGENT_MESSAGE_TYPES,
    type AgentGetAgentsRequest,
    type AgentCreateTopicAndSendRequest,
    type AgentSendMessageRequest,
    type AgentInfo,
    type TiptapJSONContent,
} from "../types"

export interface IframeAgentConfig {
    /** 向 iframe 发送消息的函数 */
    postToIframe: (message: object) => void
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
}

export class IframeAgentService {
    private readonly cfg: IframeAgentConfig

    constructor(cfg: IframeAgentConfig) {
        this.cfg = cfg
    }

    /**
     * 主路由入口，由 useIframeAgent → IsolatedHTMLRenderer 的 handleMessage 调用。
     * 返回 true 表示消息已被处理。
     */
    async handleMessage(type: string, payload: unknown): Promise<boolean> {
        switch (type) {
            case AGENT_MESSAGE_TYPES.GET_AGENTS_REQUEST:
                await this.handleGetAgents(payload as AgentGetAgentsRequest)
                return true
            case AGENT_MESSAGE_TYPES.CREATE_TOPIC_AND_SEND_REQUEST:
                await this.handleCreateTopicAndSend(payload as AgentCreateTopicAndSendRequest)
                return true
            case AGENT_MESSAGE_TYPES.SEND_MESSAGE_REQUEST:
                await this.handleSendMessage(payload as AgentSendMessageRequest)
                return true
            default:
                return false
        }
    }

    private async handleGetAgents(req: AgentGetAgentsRequest): Promise<void> {
        try {
            const agents = this.cfg.getAgentList()
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.GET_AGENTS_RESPONSE,
                requestId: req.requestId,
                success: true,
                agents,
            })
        } catch (error) {
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.GET_AGENTS_RESPONSE,
                requestId: req.requestId,
                success: false,
                error: error instanceof Error ? error.message : "Failed to get agents",
            })
        }
    }

    private async handleCreateTopicAndSend(req: AgentCreateTopicAndSendRequest): Promise<void> {
        try {
            const result = await this.cfg.createTopicAndSend({
                message: req.message,
                agentId: req.agentId,
                model: req.model,
            })
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.CREATE_TOPIC_AND_SEND_RESPONSE,
                requestId: req.requestId,
                success: true,
                topicId: result.topicId,
            })
        } catch (error) {
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.CREATE_TOPIC_AND_SEND_RESPONSE,
                requestId: req.requestId,
                success: false,
                error: error instanceof Error ? error.message : "Failed to create topic and send",
            })
        }
    }

    private async handleSendMessage(req: AgentSendMessageRequest): Promise<void> {
        try {
            await this.cfg.sendMessage({
                message: req.message,
                model: req.model,
            })
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.SEND_MESSAGE_RESPONSE,
                requestId: req.requestId,
                success: true,
            })
        } catch (error) {
            this.cfg.postToIframe({
                type: AGENT_MESSAGE_TYPES.SEND_MESSAGE_RESPONSE,
                requestId: req.requestId,
                success: false,
                error: error instanceof Error ? error.message : "Failed to send message",
            })
        }
    }

    destroy(): void {
        // No cleanup needed currently
    }
}
