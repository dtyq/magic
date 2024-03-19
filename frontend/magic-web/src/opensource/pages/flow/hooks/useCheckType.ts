/**
 * 检查当前流程还是Agent
 */

import { useMemo } from "react"
import { useParams } from "react-router"
import { MAGIC_FLOW_ID_PREFIX } from "../constants"

type UseCheckTypeProps = {
	/** 通用标识符，用于非路由场景，可以是 toolCode、agentId、subFlowId 等 */
	id?: string
	/** 显式指定是否为 Agent，用于非路由场景 */
	isAgentOverride?: boolean
}

export default function useCheckType(props: UseCheckTypeProps = {}) {
	const { id: propsId, isAgentOverride } = props
	const { id: paramsId } = useParams()
	const agentId = (propsId || paramsId) as string

	const isAgent = useMemo(() => {
		// 如果显式指定了 isAgent，优先使用
		if (isAgentOverride !== undefined) {
			return isAgentOverride
		}

		// 否则通过id的前缀进行判断
		return Boolean(agentId && !agentId.startsWith(MAGIC_FLOW_ID_PREFIX))
	}, [agentId, isAgentOverride])

	return {
		isAgent,
	}
}
