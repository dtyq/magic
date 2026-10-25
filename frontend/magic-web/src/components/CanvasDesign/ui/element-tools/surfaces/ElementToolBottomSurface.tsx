import { useMemo } from "react"
import type { TFunction } from "../../../public/i18n-types"
import type { ElementToolResolution } from "../../../runtime/element-tools"
import type { ElementBottomToolbarSection } from "../../canvas-editor/element-bottom-toolbar/ElementBottomToolbar"
import { ElementBottomToolbar } from "../../canvas-editor/element-bottom-toolbar/ElementBottomToolbar"
import BottomActionRenderer from "../renderers/BottomActionRenderer"
import BottomVersionControlsRenderer from "../renderers/BottomVersionControlsRenderer"

interface ElementToolBottomSurfaceProps {
	tools: readonly ElementToolResolution[]
	t: TFunction
	elementId?: string | null
}

export default function ElementToolBottomSurface({
	tools,
	t,
	elementId,
}: ElementToolBottomSurfaceProps) {
	const sections = useMemo<ElementBottomToolbarSection[]>(() => {
		const actionTools = tools.filter((tool) => tool.presentation.renderKind === "bottom-action")
		const versionTools = tools.filter(
			(tool) => tool.presentation.renderKind === "bottom-version-controls",
		)
		const result: ElementBottomToolbarSection[] = []
		if (actionTools.length > 0) {
			result.push({
				id: "actions",
				group: actionTools[0].presentation.group,
				order: actionTools[0].presentation.order,
				items: BottomActionRenderer({ tools: actionTools, t }),
			})
		}
		if (versionTools.length > 0) {
			result.push({
				id: "versions",
				group: versionTools[0].presentation.group,
				order: versionTools[0].presentation.order,
				content: <BottomVersionControlsRenderer tools={versionTools} />,
			})
		}
		return result.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
	}, [t, tools])

	return (
		<ElementBottomToolbar
			floatingId="element-bottom-toolbar"
			elementId={elementId}
			ariaLabel={t("elementBottomToolbar.label", "元素底部工具栏")}
			sections={sections}
			shouldShow={() => tools.length > 0}
		/>
	)
}
