import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ScheduledTask } from "@/types/scheduledTask"
import type { MicroAppScheduledTaskContext } from "./types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"

export { formatTaskSchedule } from "@/pages/superMagic/components/ScheduledTasks/utils"

function prependRuntimeAppMention(content: JSONContent, mention: MentionListItem) {
	// Move existing references to the front, without stripping other user-authored mentions.
	function removeCurrentApp(node: JSONContent): JSONContent[] {
		if (
			node.type === "mention" &&
			node.attrs?.type === "micro_app" &&
			node.attrs.data?.app_id === (mention.attrs.data as { app_id: string }).app_id
		)
			return []
		return [
			{ ...node, ...(node.content && { content: node.content.flatMap(removeCurrentApp) }) },
		]
	}
	const children = content.content?.flatMap(removeCurrentApp) ?? []
	return {
		...content,
		content:
			children[0]?.type === "paragraph"
				? [
						{ ...children[0], content: [mention, ...(children[0].content ?? [])] },
						...children.slice(1),
					]
				: [{ type: "paragraph", content: [mention] }, ...children],
	}
}

/** Keeps every micro-app task submission bound to its owning workspace and project. */
export function applyMicroAppScheduledTaskContext(
	task: ScheduledTask.UpdateTask,
	context: MicroAppScheduledTaskContext,
): ScheduledTask.UpdateTask {
	// Only runtime previews inject the app identity; development tasks keep their existing content.
	const mention: MentionListItem | undefined = context.microAppId
		? {
				type: "mention",
				attrs: {
					type: "micro_app",
					data: {
						app_id: context.microAppId,
						app_name: context.microAppName || context.microAppId,
					},
				},
			}
		: undefined
	const content = mention
		? prependRuntimeAppMention(
				typeof task.message_content.content === "string"
					? JSON.parse(task.message_content.content)
					: task.message_content.content,
				mention,
			)
		: undefined
	return {
		...task,
		workspace_id: context.workspaceId,
		project_id: context.projectId,
		message_content: {
			...task.message_content,
			...(content && { content: JSON.stringify(content) }),
			extra: {
				...task.message_content.extra,
				super_agent: {
					...task.message_content.extra?.super_agent,
					...(mention && {
						mentions: [
							mention,
							...(task.message_content.extra?.super_agent.mentions ?? []).filter(
								(item) =>
									!(
										item.attrs.type === "micro_app" &&
										"app_id" in item.attrs.data &&
										item.attrs.data.app_id === context.microAppId
									),
							),
						],
					}),
					// Runtime tasks keep the chosen employee while the owning project remains fixed.
					topic_pattern: context.microAppId
						? task.message_content.extra?.super_agent.topic_pattern
						: TopicMode.MicroApp,
				},
			},
		},
	}
}
