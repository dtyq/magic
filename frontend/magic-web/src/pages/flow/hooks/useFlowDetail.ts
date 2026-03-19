/**
 * 流程相关状态
 */
import { useFlowStore } from "@/stores/flow"
import type { Bot } from "@/types/bot"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { FlowApi } from "@/apis"
import { useOrganization } from "@/models/user/hooks"
import useCheckType from "./useCheckType"
import useLoadFlow from "./useLoadFlow"
import { unShadowFlow } from "../utils/helpers"
import { Status } from "../agent/constants"
import { RouteName } from "@/routes/constants"
import magicToast from "@/components/base/MagicToaster/utils"

type FlowDetailProps = {
	agent: Bot.Detail
	showFlowIsDraftToast: () => void
	/** 通用标识符，用于覆盖路由参数中的id，可以是 toolCode、agentId、subFlowId 等 */
	id?: string
	/** 是否在 Modal 中，影响组织变更时的行为 */
	inModal?: boolean
}

export default function useFlowDetail({
	agent,
	showFlowIsDraftToast,
	id: propsId,
	inModal = false,
}: FlowDetailProps) {
	const { t } = useTranslation()
	const { id: paramsId } = useParams()
	const flowId = (propsId || paramsId) as string

	const { isAgent } = useCheckType({ id: propsId })

	const navigate = useNavigate()

	const { updateFlowDraftList, updateFlowPublishList, draftList } = useFlowStore()

	const [currentFlow, setCurrentFlow] = useState<MagicFlow.Flow>()

	useMount(() => {
		// 初次加载先重置版本和草稿数据，避免脏数据影响
		updateFlowPublishList([])
		updateFlowDraftList([])
	})

	const { organizationCode } = useOrganization()

	const initPublishList = useMemoizedFn(async (flowCode) => {
		const publishData = await FlowApi.getFlowPublishList(flowCode)
		updateFlowPublishList(publishData.list)
	})

	/**
	 * 加载最新草稿
	 */
	const loadLatestDraft = useMemoizedFn(
		async (flowCode: string, extraProps?: Record<string, any>) => {
			const lastDraft = draftList[0]
			if (lastDraft) {
				const draftDetail = await FlowApi.getFlowDraftDetail(flowCode, lastDraft.id)

				const decodeFlow = unShadowFlow(draftDetail.magic_flow)
				setCurrentFlow({
					...decodeFlow,
					...extraProps,
					// 旧数据可能是id也可能是code，因此做一下兼容
					id: decodeFlow.code || decodeFlow.id,
				})
				showFlowIsDraftToast()
			}
		},
	)

	const { loadConfirmUI } = useLoadFlow({ isAgent, agent, loadLatestDraft, flowId })

	const initDraftList = useMemoizedFn(async (flowCode) => {
		const draftData = await FlowApi.getFlowDraftList(flowCode)
		updateFlowDraftList(draftData.list)
		loadConfirmUI(draftData.list)
		return draftData.list
	})

	// 初始化版本列表和草稿列表
	const initFlowData = useMemoizedFn(async () => {
		// 如果有值说明初始化过了，不必再走下面代码（除非 propsId 改变了）
		if (currentFlow && !propsId) return
		if (!isAgent) {
			initPublishList(flowId)
			const latestDraftList = await initDraftList(flowId)
			const data = await FlowApi.getFlow(flowId)
			// 未发布过，自动加载最新草稿
			if (!data.enabled && latestDraftList.length > 0) {
				loadLatestDraft(flowId, {
					enabled: data.enabled,
				})
				return
			}
			setCurrentFlow({ ...data })
			return
		}
		if (agent?.magicFlowEntity?.id) {
			// initPublishList(agent.magicFlowEntity.id)
			const latestDraftList = await initDraftList(agent.magicFlowEntity.id)
			// 当不存在版本时，则说明没有发布过，则加载最新草稿(有草稿的情况下)
			if (!agent?.botVersionEntity && latestDraftList.length > 0) {
				loadLatestDraft(agent.magicFlowEntity.id, {
					user_operation: agent.botEntity.user_operation,
					icon: agent.botEntity.robot_avatar,
					name: agent.botEntity.robot_name,
					enabled: agent.botEntity.status === Status.enable,
				})
				showFlowIsDraftToast()
				return
			}

			setCurrentFlow({
				...agent.magicFlowEntity,
				id: agent.magicFlowEntity.id,
				user_operation: agent.botEntity.user_operation,
				icon: agent.botEntity.robot_avatar,
				name: agent.botEntity.robot_name,
				enabled: agent.botEntity.status === Status.enable,
			})
		}
	})

	useUpdateEffect(() => {
		if (!inModal) {
			magicToast.info(t("common.organizationChangeTips", { ns: "flow" }))
			setTimeout(() => {
				navigate({ name: RouteName.AgentList })
			}, 1000)
		}
	}, [organizationCode, inModal])

	useEffect(() => {
		initFlowData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [agent, propsId])

	return {
		currentFlow,
		setCurrentFlow,
		initDraftList,
		initPublishList,
	}
}
