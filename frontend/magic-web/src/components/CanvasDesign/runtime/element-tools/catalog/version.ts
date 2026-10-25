import { ElementToolTypeEnum } from "../../../public/props"
import { ElementTypeEnum } from "../../document/types"
import type { ElementToolDefinition } from "../model/ElementToolTypes"
import { resolveTool } from "./common"
import { bottomVersionControls } from "./surfaceOptions"

const versionToolIds = [
	ElementToolTypeEnum.VersionPrevious,
	ElementToolTypeEnum.VersionNext,
	ElementToolTypeEnum.VersionCount,
	ElementToolTypeEnum.VersionSetMain,
	ElementToolTypeEnum.VersionDelete,
] as const

export const VERSION_TOOL_DEFINITIONS: ElementToolDefinition[] = versionToolIds.map((id, index) => {
	const presentation = bottomVersionControls(100 + index)
	return {
		id,
		scope: "version-set",
		effect:
			id === ElementToolTypeEnum.VersionCount
				? "display"
				: id === ElementToolTypeEnum.VersionPrevious ||
					  id === ElementToolTypeEnum.VersionNext
					? "session"
					: id === ElementToolTypeEnum.VersionDelete
						? "destructive"
						: "document",
		requiredCapability:
			id === ElementToolTypeEnum.VersionCount
				? "document.read"
				: id === ElementToolTypeEnum.VersionPrevious ||
					  id === ElementToolTypeEnum.VersionNext
					? "interaction.switchContent"
					: id === ElementToolTypeEnum.VersionDelete
						? "document.delete"
						: "document.write",
		commandRoute: id === ElementToolTypeEnum.VersionCount ? "registered" : "version",
		execution: id === ElementToolTypeEnum.VersionCount ? "display-only" : "command",
		surfaces: { bottom: presentation },
		isApplicable: (context) =>
			(context.element.type === ElementTypeEnum.Image ||
				context.element.type === ElementTypeEnum.Video ||
				context.element.type === ElementTypeEnum.Audio) &&
			context.content.byId.size > 1,
		resolve: (context) => {
			const contents = [...context.content.byId.values()]
			const current = Math.max(
				0,
				contents.findIndex(
					(content) => content.contentId === context.content.activeContentId,
				),
			)
			const hidden =
				(id === ElementToolTypeEnum.VersionSetMain &&
					!context.capabilities.canSetMainVersion) ||
				(id === ElementToolTypeEnum.VersionDelete && !context.capabilities.canDeleteVersion)
			return resolveTool(context, id, "bottom", presentation, {
				visibility: hidden ? "hidden" : "visible",
				execution: id === ElementToolTypeEnum.VersionCount ? "display-only" : "command",
				data: {
					version: {
						current: current + 1,
						total: contents.length,
						isMain: context.content.activeContentId === context.content.mainContentId,
					},
				},
			})
		},
	}
})
