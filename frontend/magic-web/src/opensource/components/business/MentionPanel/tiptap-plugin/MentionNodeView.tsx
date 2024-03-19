import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { memo } from "react"
import {
	getMentionDisplayName,
	type MentionPanelPluginOptions,
	type TiptapMentionAttributes,
} from "./types"

function MentionNodeView(props: ReactNodeViewProps) {
	const attrs = props.node.attrs as TiptapMentionAttributes
	const options = props.extension.options as MentionPanelPluginOptions
	const Renderer = options.nodeViewRenderers?.[attrs.type]

	if (Renderer) {
		return <Renderer {...props} attrs={attrs} />
	}

	return (
		<NodeViewWrapper
			as="span"
			className="magic-mention"
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			contentEditable={false}
		>
			{`@${getMentionDisplayName(attrs)}`}
		</NodeViewWrapper>
	)
}

export default memo(MentionNodeView)
