import { useMemo } from "react"
import { flushSync } from "react-dom"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useHostConversation } from "@/pages/superMagic/contexts/HostConversationContext"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { createDirectoryMentionData } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import {
	parseSkillDirFromSkillMdRelativePath,
	normalizeRelativeFilePath,
} from "@/pages/superMagic/pages/SkillEdit/utils/skill-workspace-manifest"
import {
	handleAttachmentDragStart,
	handleTabDragEnd,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

export function useMicroAppSkillActions(attachmentList: AttachmentItem[], canEdit: boolean) {
	// The provider belongs to the development project; never fall back to a global conversation.
	const { selectedProject } = useHostConversation()
	const enabled = canEdit && Boolean(selectedProject?.id)
	const folders = useMemo(() => {
		const result = new Map<string, AttachmentItem>()
		const stack = [...attachmentList].reverse()
		while (stack.length) {
			const item = stack.pop()
			if (!item) continue
			// Traverse children before filtering: grouping parents may have no file ID or skill path.
			const children = item.children ?? []
			for (let index = children.length - 1; index >= 0; index--) {
				stack.push(children[index])
			}
			if (!(item.is_directory || item.type === "directory") || !item.file_id) continue
			const path = normalizeRelativeFilePath(item.relative_file_path)
			const directory = parseSkillDirFromSkillMdRelativePath(`${path}/SKILL.md`)
			if (!directory) continue
			// Keep drag payloads independent of folder children, which can contain the entire project.
			result.set(directory, {
				file_id: item.file_id,
				file_name: item.file_name || item.name || path.split("/").pop(),
				relative_file_path: path,
				is_directory: true,
				project_id: selectedProject?.id,
			})
		}
		return result
	}, [attachmentList, selectedProject?.id])
	const getFolder = (directory: string) => folders.get(directory)
	const getMention = (folder: AttachmentItem) => ({
		type: MentionItemType.FOLDER as const,
		data: { ...createDirectoryMentionData(folder), project_id: selectedProject?.id },
	})
	function expandConversation() {
		// A collapsed conversation unmounts its editor; mount its subscriptions before publishing.
		flushSync(() => pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel))
	}
	function addToConversation(directory: string) {
		const folder = getFolder(directory)
		if (!enabled || !folder) return
		expandConversation()
		pubsub.publish(PubSubEvents.Add_File_To_Chat, {
			items: [getMention(folder)],
			is_new_topic: false,
			autoFocus: true,
		})
	}
	function startDrag(event: React.DragEvent, directory: string) {
		const folder = getFolder(directory)
		if (!enabled || !folder) {
			event.preventDefault()
			return
		}
		expandConversation()
		event.dataTransfer.effectAllowed = "copy"
		handleAttachmentDragStart(event, folder, getMention(folder))
	}
	async function createSkill(prompt: string): Promise<boolean> {
		if (!enabled) return false
		expandConversation()
		return new Promise<boolean>((resolve) => {
			let claimed = false
			pubsub.publish(PubSubEvents.Send_Message_by_Content, {
				jsonContent: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: prompt }] }],
				},
				targetProjectId: selectedProject?.id,
				shouldClearEditorAfterSend: false,
				tryClaim: () => {
					if (claimed) return false
					claimed = true
					return true
				},
				onHandled: resolve,
			})
			if (!claimed) resolve(false)
		})
	}
	return {
		enabled,
		getFolder,
		addToConversation,
		startDrag,
		endDrag: handleTabDragEnd,
		createSkill,
	}
}
