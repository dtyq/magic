import { Topic, Workspace } from "../../../pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import { useMemoizedFn, useThrottleFn } from "ahooks"
import { logger as Logger } from "@/utils/log"
import { Editor } from "@tiptap/core"
import { useEffect } from "react"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"

const logger = Logger.createLogger("useSandboxPreWarm")

function useSandboxPreWarm({
	selectedTopic,
	selectedWorkspace,
	projectId,
	editorRef,
	enabled = true,
}: {
	selectedTopic?: Topic | null
	selectedWorkspace?: Workspace | null
	projectId?: string | null
	editorRef?: Editor | null
	enabled?: boolean
}) {
	const { run: preWarmSandbox, cancel: cancelPreWarmSandbox } = useThrottleFn(
		useMemoizedFn(() => {
			if (!selectedTopic && !selectedWorkspace && !projectId) {
				return
			}

			const params = selectedTopic
				? { topic_id: selectedTopic.id }
				: projectId
					? { project_id: projectId }
					: { workspace_id: selectedWorkspace?.id }

			// 共享工作区不预加载沙箱，共享工作区是一个虚拟概念
			if (params.workspace_id && params.workspace_id === SHARE_WORKSPACE_ID) {
				return
			}

			SuperMagicApi.preWarmSandbox(params).catch((error) => {
				logger.error("preWarmSandbox error", error)
			})
		}),
		{
			wait: 5000,
			leading: true,
			trailing: false,
		},
	)

	// 切换话题或工作区时，取消历史请求
	useEffect(() => {
		return () => {
			cancelPreWarmSandbox()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic, selectedWorkspace, projectId])

	useEffect(() => {
		if (!enabled) {
			return
		}

		preWarmSandbox()
	}, [enabled, preWarmSandbox, projectId, selectedTopic?.id, selectedWorkspace?.id])

	useEffect(() => {
		if (!editorRef) {
			return
		}

		editorRef.on("focus", preWarmSandbox)

		editorRef.on("update", preWarmSandbox)

		return () => {
			if (!editorRef) {
				return
			}

			editorRef.off("focus", preWarmSandbox)
			editorRef.off("update", preWarmSandbox)
		}
	}, [editorRef, preWarmSandbox])
}

export default useSandboxPreWarm
