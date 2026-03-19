/**
 * 管理Agent相关数据状态
 */
import type { Bot } from "@/types/bot"
import { useMemoizedFn, useMount } from "ahooks"
import { useState } from "react"
import { useParams } from "react-router"
import { botStore } from "@/stores/bot"
import { BotApi } from "@/apis"
import useCheckType from "./useCheckType"

export default function useAgent() {
	const { id } = useParams()
	const agentId = id as string

	const { isAgent } = useCheckType()

	const [data, setData] = useState<Bot.Detail>({} as Bot.Detail)
	const [magicName, setMagicName] = useState<string>("")

	const getBotDetail = useMemoizedFn(async (botId: string) => {
		if (!isAgent) return
		const res = await BotApi.getBotDetail(botId)
		setMagicName(res.botEntity.robot_name)
		setData(res)
		botStore.setInstructList(res.botEntity.instructs)
	})

	const initAgentPublishList = useMemoizedFn(async (botId: string) => {
		if (!isAgent) return
		const res = await BotApi.getBotVersionList(botId)
		botStore.setPublishList(res)
	})

	useMount(() => {
		if (!agentId) return
		getBotDetail(agentId)
		initAgentPublishList(agentId)
	})

	return {
		// isBotUpdate,
		magicName,
		agent: data,
		setAgent: setData,
		initAgentPublishList,
	}
}
