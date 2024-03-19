/**
 * 流程tab的数据
 */

import { nodeManager } from "@/MagicFlow/register/node"
import { getNodeSchema } from "@/MagicFlow/utils"
import { useMemo } from "react"
import { TabObject } from "../../../constants"
import { AgentType } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { useStore } from "zustand"
import { flowStore } from "@/MagicFlow/store"
import i18next from "i18next"

export default function usePanelAgent() {
	const { nodeVersionSchema } = useStore(flowStore, (state) => state)

	const schema = useMemo(() => {
		const flowNodeType = nodeManager?.materialNodeTypeMap?.[TabObject.Agent]
		if (!flowNodeType) return null
		return getNodeSchema(flowNodeType)
	}, [nodeVersionSchema])

	const options = useMemo(() => {
		return [
			{
				label: i18next.t("flow.personalAgent", { ns: "magicFlow" }),
				value: AgentType.Person,
			},
			{
				label: i18next.t("flow.enterpriseAgent", { ns: "magicFlow" }),
				value: AgentType.Enterprise,
			},
			{
				label: i18next.t("flow.agentMarket", { ns: "magicFlow" }),
				value: AgentType.Market,
			},
		]
	}, [])

	return {
		schema,
		options,
	}
}
