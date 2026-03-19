/**
 * 编辑Agent基础信息的弹层及其相关数据状态
 */

import AddOrUpdateAgent from "@/pages/explore/components/AddOrUpdateAgent"
import type { Bot } from "@/types/bot"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"

type EditAgentModalProps = {
	agent: Bot.Detail
	setAgent: React.Dispatch<React.SetStateAction<Bot.Detail>>
	currentFlow?: MagicFlow.Flow
	setCurrentFlow: React.Dispatch<React.SetStateAction<MagicFlow.Flow | undefined>>
}

export default function useEditAgentModal({
	agent,
	setAgent,
	currentFlow,
	setCurrentFlow,
}: EditAgentModalProps) {
	const [addAgentModalOpen, { setTrue: openAddAgentModal, setFalse: closeAddAgentModal }] =
		useBoolean(false)

	const updateAgent = useMemoizedFn((data: Bot.Detail["botEntity"]) => {
		if (!currentFlow) return
		setCurrentFlow(() => {
			return {
				...currentFlow,
				name: data.robot_name,
				icon: data.robot_avatar,
			}
		})
		setAgent((prev) => {
			return {
				...prev,
				botEntity: {
					...prev.botEntity,
					robot_name: data.robot_name,
					robot_avatar: data.robot_avatar,
					robot_description: data.robot_description,
				},
			}
		})
	})

	const EditAgentModal = useMemo(() => {
		return (
			<AddOrUpdateAgent
				open={addAgentModalOpen}
				close={closeAddAgentModal}
				submit={updateAgent}
				agent={{
					...agent.botEntity,
				}}
			/>
		)
	}, [addAgentModalOpen, closeAddAgentModal, updateAgent, agent.botEntity])

	return {
		EditAgentModal,
		openAddAgentModal,
	}
}
