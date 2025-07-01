import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion"
import { forwardRef, useImperativeHandle, useRef } from "react"
import type {
	MentionSelectItem,
	MentionSelectRef,
} from "@/opensource/components/business/MentionSelect"
import MentionSelect from "@/opensource/components/business/MentionSelect"

export type MentionListRef = {
	onKeyDown: (event: SuggestionKeyDownProps) => boolean
	ref: MentionSelectRef | null
}

export type MentionListProps = SuggestionProps<MentionSelectItem> & {
	top?: number
	left?: number
	getParentDom: () => HTMLElement | null
}

const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
	const userSelectRef = useRef<MentionSelectRef>(null)

	const selectItem = (index: MentionSelectItem) => {
		props.command({ id: index.id, label: index.name, type: index.type })
	}

	useImperativeHandle(ref, () => ({
		onKeyDown: ({ event }) => {
			switch (event.key) {
				case "ArrowUp":
					event.stopPropagation()
					userSelectRef.current?.prevUser()
					return true
				case "ArrowDown":
					event.stopPropagation()
					userSelectRef.current?.nextUser()
					return true
				case "Enter":
					event.stopPropagation()
					userSelectRef.current?.confirmItem()
					return true
				default:
					return false
			}
		},
		ref: userSelectRef.current,
	}))

	return (
		<MentionSelect
			ref={userSelectRef}
			keyword={props.query}
			onSelect={selectItem}
			arrow={false}
			getPopupContainer={(triggerNode) =>
				props.getParentDom() ?? (triggerNode.parentNode as HTMLElement)
			}
			overlayStyle={{
				top: 20,
				left: 20,
			}}
			placement="top"
		/>
	)
})

export default MentionList
