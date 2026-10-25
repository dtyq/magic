import type { InspectorDetailAttrs } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/types"
import { InspectorDetailView } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/component"

interface InspectorDetailReadOnlyProps {
	attrs: InspectorDetailAttrs
}

export function InspectorDetailReadOnly({ attrs }: InspectorDetailReadOnlyProps) {
	return <InspectorDetailView attrs={attrs} />
}
