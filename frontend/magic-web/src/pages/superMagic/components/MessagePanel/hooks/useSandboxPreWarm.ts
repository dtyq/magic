import { Topic, Workspace } from "../../../pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import { useMemoizedFn, useThrottleFn } from "ahooks"
import { logger as Logger } from "@/utils/log"
import { Editor } from "@tiptap/core"
import { useEffect } from "react"

const logger = Logger.createLogger("useSandboxPreWarm")

function useSandboxPreWarm({
	selectedTopic,
	selectedWorkspace,
	editorRef,
}: {
	selectedTopic?: Topic | null
	selectedWorkspace?: Workspace | null
	editorRef?: Editor | null
}) {
	const { run: preWarmSandbox, cancel: cancelPreWarmSandbox } = useThrottleFn(
		useMemoizedFn(() => {
			if (!selectedTopic && !selectedWorkspace) {
				return
			}

			SuperMagicApi.preWarmSandbox(
				selectedTopic
					? {
						topic_id: selectedTopic?.id,
					}
					: {
						workspace_id: selectedWorkspace?.id,
					},
			).catch((error) => {
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
	}, [selectedTopic, selectedWorkspace])

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
