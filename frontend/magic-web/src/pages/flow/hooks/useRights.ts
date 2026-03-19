/**
 * Agent权限相关
 */
import { useMemo } from "react"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { Bot } from "@/types/bot"
import { ScopeType } from "@/types/bot"
import { hasAdminRight, hasEditRight } from "../components/AuthControlButton/types"

type RightProps = {
	flow: MagicFlow.Flow
	agent: Bot.Detail
}

export default function useRights({ flow, agent }: RightProps) {
	const isEditRight = useMemo(() => {
		return hasEditRight(flow?.user_operation)
	}, [flow?.user_operation])

	const isAdminRight = useMemo(() => {
		return hasAdminRight(flow?.user_operation)
	}, [flow?.user_operation])

	const isReleasedToMarket = useMemo(() => {
		if (!agent?.botVersionEntity) return false
		return agent?.botVersionEntity?.release_scope !== ScopeType.private
	}, [agent?.botVersionEntity])

	return {
		isEditRight,
		isAdminRight,
		isReleasedToMarket,
	}
}
