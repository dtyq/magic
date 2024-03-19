import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import type { JSONContent } from "@tiptap/react"
import BaseMessageEditor from "@/opensource/pages/superMagic/components/MessageEditor"
import type { ModelItem } from "@/opensource/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type {
	MessageEditorProps as BaseMessageEditorProps,
	MessageEditorRef as BaseMessageEditorRef,
} from "@/opensource/pages/superMagic/components/MessageEditor/types"
import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"

export type MessageEditorRef = BaseMessageEditorRef & {
	selectedModel: ModelItem | null
	setSelectedModel: (model: ModelItem | null) => void
	mentionItems: MentionListItem[]
}

export interface MessageEditorProps extends BaseMessageEditorProps {
	showModeToggle?: boolean
	allowChangeMode?: boolean
	selectedModel?: ModelItem | null
	value?: JSONContent
	onChange?: (content: JSONContent | undefined) => void
}

const MessageEditor = forwardRef<MessageEditorRef, MessageEditorProps>(function MessageEditor(
	{ selectedModel: selectedModelProp = null, ...props },
	ref,
) {
	const innerRef = useRef<BaseMessageEditorRef | null>(null)
	const [selectedModel, setSelectedModelState] = useState<ModelItem | null>(selectedModelProp)

	useImperativeHandle(ref, () => {
		const currentEditor = innerRef.current

		return {
			...(currentEditor as BaseMessageEditorRef),
			get selectedModel() {
				return currentEditor?.selectedModel ?? selectedModel
			},
			setSelectedModel(model: ModelItem | null) {
				setSelectedModelState(model)
				currentEditor?.setSelectedModel?.(model)
			},
			get mentionItems() {
				return currentEditor?.mentionItems ?? []
			},
		}
	}, [selectedModel])

	return (
		<BaseMessageEditor
			ref={innerRef}
			selectedModel={selectedModel}
			onChange={props.onChange}
			value={props.value}
			{...props}
		/>
	)
})

export default MessageEditor
