/**
 * 切换草稿的额外操作
 */

import { getCurrentDateTimeString } from "@/opensource/pages/flow/utils/helpers"
import type { FlowDraft } from "@/opensource/types/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useMemoizedFn } from "ahooks"
import { FlowApi } from "@/opensource/apis"

type UseDraftSwitchExtraProps = {
	flow?: MagicFlow.Flow
	initDraftList: (this: any, flowCode: any) => Promise<FlowDraft.Detail[]>
}

export default function useDraftSwitchExtra({ flow, initDraftList }: UseDraftSwitchExtraProps) {
	const saveDraft = useMemoizedFn(async (draftDetail: FlowDraft.Detail) => {
		// const oldFlowUpdatedAt = flow?.updated_at
		// const newDraftUpdatedAt = draftDetail?.updated_at

		// const isRollback = compareTimes(newDraftUpdatedAt, oldFlowUpdatedAt)

		// // 只有回滚才需要新增
		// if(!isRollback) return

		const requestParams = {
			name: `${flow?.name}_草稿${getCurrentDateTimeString()}`,
			description: "",
			magic_flow: {
				...draftDetail.magic_flow,
				// @ts-ignore
				global_variable: flow?.global_variable,
			},
		}

		if (!flow?.id) return

		await FlowApi.saveFlowDraft(requestParams, flow.id)

		initDraftList?.(flow.id)
	})

	return {
		saveDraft,
	}
}
