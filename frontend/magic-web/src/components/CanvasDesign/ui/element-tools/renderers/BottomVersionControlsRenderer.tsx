import type { ElementToolResolution } from "../../../runtime/element-tools"
import ElementVersionControls from "../components/version/ElementVersionControls"

export default function BottomVersionControlsRenderer({
	tools,
}: {
	tools: readonly ElementToolResolution[]
}) {
	return <ElementVersionControls tools={tools} />
}
