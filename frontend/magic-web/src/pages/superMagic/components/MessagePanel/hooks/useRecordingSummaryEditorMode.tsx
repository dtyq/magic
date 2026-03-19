import { useEffect, useMemo, useState } from "react"
import { Topic } from "../../../pages/Workspace/types"
import EditorModeSwitchService from "../services/EditorModeSwitchService"
import { useMemoizedFn } from "ahooks"
import { useUserInfo } from "@/models/user/hooks"
import { RecordingSummaryEditorMode } from "../const/recordSummary"

function useRecordingSummaryEditorMode({
	selectedTopic,
	hasMessage,
}: {
	selectedTopic: Topic | null
	hasMessage: boolean
}) {
	const { userInfo } = useUserInfo()
	const userId = useMemo(() => {
		const info = userInfo as unknown as { user_id?: string }
		if (info?.user_id) return info.user_id
		return "legacy"
	}, [userInfo])

	const topicId = selectedTopic?.id || ""

	const [editorMode, _setEditorMode] = useState<RecordingSummaryEditorMode>(
		EditorModeSwitchService.getEditorMode({
			userId,
			topicId,
		}),
	)

	useEffect(() => {
		_setEditorMode(
			EditorModeSwitchService.getEditorMode({
				userId,
				topicId,
			}),
		)
	}, [topicId, userId])

	const setEditorMode = useMemoizedFn((editorMode: RecordingSummaryEditorMode) => {
		EditorModeSwitchService.saveDefaultEditorMode({
			userId,
			topicId,
			editorMode,
		})
		_setEditorMode(editorMode)
	})

	useEffect(() => {
		if (
			hasMessage &&
			topicId &&
			!EditorModeSwitchService.hasDefaultEditorMode({
				userId,
				topicId,
			})
		) {
			setEditorMode(RecordingSummaryEditorMode.Editing)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [topicId, hasMessage, userId])

	return {
		editorMode,
		setEditorMode,
	}
}

export default useRecordingSummaryEditorMode
