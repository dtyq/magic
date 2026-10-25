import type { TFunction } from "../../../../public/i18n-types"
import type { ElementToolResolution } from "../../../../runtime/element-tools"
import type { ElementBottomToolbarItem } from "../../../canvas-editor/element-bottom-toolbar/ElementBottomToolbar"
import BottomActionRenderer from "../../renderers/BottomActionRenderer"

export default function GenerationActionRenderer({
	tool,
	t,
}: {
	tool: ElementToolResolution
	t: TFunction
}): ElementBottomToolbarItem {
	const item = BottomActionRenderer({ tools: [tool], t })[0]
	if (!item) throw new Error(`Missing bottom action for ${tool.id}`)
	return item
}
