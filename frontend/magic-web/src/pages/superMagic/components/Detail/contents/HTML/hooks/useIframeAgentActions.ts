/**
 * useIframeAgentActions
 *
 * 封装 iframe agent 相关的业务逻辑：获取 agent 列表、创建话题并发送消息、在当前话题发送消息。
 * 返回值可直接传入 useIframeAgent。
 */

import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { AgentType } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { SuperMagicApi } from "@/apis"
import { topicStore, projectStore } from "@/pages/superMagic/stores/core"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import type { AgentInfo, TiptapJSONContent } from "../iframe-api/types"

export function useIframeAgentActions() {
    /**
     * 将 message 参数转换为 tiptap jsonContent。
     * - string: 包装为简单的 doc > paragraph > text 结构
     * - object (TiptapJSONContent): 直接使用（已包含 mention 等节点）
     */
    const toJsonContent = (message: string | TiptapJSONContent) => {
        if (typeof message === "string") {
            return {
                type: "doc" as const,
                content: [
                    { type: "paragraph", content: [{ type: "text", text: message }] },
                ],
            }
        }
        return message
    }

    const getAgentList = useMemoizedFn((): AgentInfo[] => {
        return superMagicModeService._modeList.map((item) => ({
            id: item.mode.identifier,
            name: item.mode.name,
            icon: item.mode.icon_url || item.mode.icon,
            color: item.mode.color,
            type:
                item.agent.type === AgentType.Official
                    ? "official"
                    : item.agent.type === AgentType.Custom
                        ? "custom"
                        : "public",
        }))
    })

    const createTopicAndSend = useMemoizedFn(
        async (params: {
            message: string | TiptapJSONContent
            agentId?: string
            model?: string
        }): Promise<{ topicId: string }> => {
            const project = projectStore.selectedProject
            if (!project?.id) throw new Error("No project selected")

            // Look up the agent to determine if it's built-in or custom
            let isCustomAgent = false
            if (params.agentId) {
                const agentMode = superMagicModeService._modeList.find(
                    (item) => item.mode.identifier === params.agentId,
                )
                if (agentMode) {
                    isCustomAgent = agentMode.agent.type !== AgentType.Official
                }
            }

            const newTopic = await SuperMagicApi.createTopic({
                project_id: project.id,
                topic_name: "",
            })
            if (!newTopic?.id) throw new Error("Failed to create topic")

            // Set topic with agent_code for custom agents
            const topicWithAgent =
                isCustomAgent && params.agentId
                    ? { ...newTopic, agent_code: params.agentId }
                    : newTopic
            topicStore.setSelectedTopic(topicWithAgent)

            // Build pubsub payload
            const jsonContent = toJsonContent(params.message)

            // Delay slightly to allow topic switch to complete
            await new Promise((resolve) => setTimeout(resolve, 300))

            if (params.model) {
                await superMagicTopicModelService.saveModel(
                    newTopic.id,
                    project.id,
                    { model_id: params.model } as any,
                )
            }

            // Build extra: agent_code for custom agents, model override via super_agent.model
            const extra: Record<string, unknown> = {}
            if (isCustomAgent && params.agentId) {
                extra.agent_code = params.agentId
            }
            if (params.model) {
                extra.super_agent = { model: { model_id: params.model } }
            }

            pubsub.publish(PubSubEvents.Send_Message_by_Content, {
                jsonContent,
                ...(params.agentId
                    ? {
                        topicMode: isCustomAgent
                            ? TopicMode.CustomAgent
                            : (params.agentId as TopicMode),
                    }
                    : {}),
                ...(Object.keys(extra).length > 0 ? { extra } : {}),
            })

            return { topicId: newTopic.id }
        },
    )

    const sendMessage = useMemoizedFn(
        async (params: { message: string | TiptapJSONContent; model?: string }): Promise<void> => {

            if (params.model) {
                const topic = topicStore.selectedTopic
                const project = projectStore.selectedProject
                if (topic?.id && project?.id) {
                    await superMagicTopicModelService.saveModel(
                        topic.id,
                        project.id,
                        { model_id: params.model } as any,
                    )
                }
            }

            const jsonContent = toJsonContent(params.message)
            pubsub.publish(PubSubEvents.Send_Message_by_Content, {
                jsonContent,
                ...(params.model
                    ? { extra: { super_agent: { model: { model_id: params.model } } } }
                    : {}),
            })
        },
    )

    return { getAgentList, createTopicAndSend, sendMessage }
}
