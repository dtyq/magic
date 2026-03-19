import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { useMemoizedFn } from "ahooks"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useEffect, useState } from "react"
import { useFlowStore } from "@/stores/flow"
import { first } from "lodash-es"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { FlowDraft } from "@/types/flow"
import { useTranslation } from "react-i18next"
import { FlowApi } from "@/apis"
import { getCurrentDateTimeString, shadowFlow } from "../utils/helpers"

/**
 * 自动保存相关的状态和行为
 */

type UseAutoSaveProps = {
	flowInstance: MutableRefObject<MagicFlowInstance | null>
	isAgent: boolean
	initDraftList: (this: any, flowCode: any) => Promise<FlowDraft.Detail[]>
	setCurrentFlow: Dispatch<SetStateAction<MagicFlow.Flow | undefined>>
}
export default function useAutoSave({ flowInstance, isAgent, initDraftList }: UseAutoSaveProps) {
	const { t } = useTranslation()

	const [isSaving, setIsSaving] = useState(false)

	const { draftList } = useFlowStore()

	const [lastSaveTime, setLastSaveTime] = useState("")

	useEffect(() => {
		if (draftList.length > 0) {
			const firstDraft = first(draftList)
			if (firstDraft) {
				setLastSaveTime(firstDraft?.updated_at)
			}
		}
	}, [draftList])

	const switchToFinished = useMemoizedFn(() => {
		setTimeout(() => {
			setIsSaving(false)
		}, 1000)
	})

	const saveDraft = useMemoizedFn(async () => {
		const latestFlow = flowInstance?.current?.getFlow()
		const shadowedFlow = shadowFlow(latestFlow!)
		if (!latestFlow) return

		const flowId = isAgent ? (shadowedFlow.id ?? "") : (latestFlow?.id ?? "")

		const requestParams = {
			name: `${latestFlow?.name}_${t("common.draft", {
				ns: "flow",
			})}${getCurrentDateTimeString()}`,
			description: "",
			magic_flow: {
				...shadowedFlow,
				// @ts-ignore
				global_variable: latestFlow?.global_variable,
			},
		}
		setIsSaving(true)
		try {
			const draft = await FlowApi.saveFlowDraft(requestParams, flowId)
			setLastSaveTime(draft.updated_at)
			switchToFinished()
		} catch (err) {
			switchToFinished()
		}
		initDraftList?.(flowId)
	})

	return {
		lastSaveTime,
		isSaving,
		saveDraft,
	}
}
