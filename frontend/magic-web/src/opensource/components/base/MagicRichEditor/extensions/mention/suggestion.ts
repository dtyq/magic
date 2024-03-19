import { ReactRenderer } from "@tiptap/react"
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion"
import type { MentionSelectItem } from "@/opensource/components/business/MentionSelect"
import MentionList from "./MentionList"

export default (getParentDom: () => HTMLDivElement | null) =>
	({
		allowedPrefixes: null,
		allowSpaces: true,
		render: () => {
			const genComponentInstance = (props: SuggestionProps<MentionSelectItem>) => {
				const { top, left } = props.decorationNode?.getBoundingClientRect() ?? {}
				return new ReactRenderer(MentionList, {
					editor: props.editor,
					props: {
						...props,
						top: top ? top + 20 : undefined,
						left: left ? left + 20 : undefined,
						getParentDom,
					},
				})
			}
			let component: ReturnType<typeof genComponentInstance>

			return {
				onStart: (props) => {
					component = genComponentInstance(props)
					component.ref?.ref?.open()
				},

				onUpdate: (props) => {
					component.updateProps(props)
				},

				onKeyDown(props) {
					return component.ref?.onKeyDown(props)
				},

				onExit() {
					component.destroy()
				},
			}
		},
	}) as Omit<SuggestionOptions<MentionSelectItem>, "editor">
