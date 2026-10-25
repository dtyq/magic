import type { NodeViewProps } from "@/infrastructure/editors/tiptap/core"
import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import { memo } from "react"

const MagicEmojiNodeRender = memo((props: NodeViewProps) => {
	const {
		node: {
			attrs: { code, ns, suffix = ".png", size },
		},
		extension: {
			options: { basePath, HTMLAttributes },
		},
	} = props

	return (
		<NodeViewWrapper
			as="img"
			data-type="magic-emoji"
			src={`${basePath}/${ns}${code}${suffix}`}
			width={size}
			{...HTMLAttributes}
		/>
	)
})

export default MagicEmojiNodeRender
