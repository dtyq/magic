import * as React from "react"
import { ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar"
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
	ColorHighlightPopover,
	ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import { LinkPopover, LinkButton } from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import { ProjectImageButton } from "@/components/tiptap-ui/project-image-button"
import { useProjectImage } from "@/components/tiptap-ui/project-image-button/use-project-image"
import { CopyMarkdownButton } from "@/components/tiptap-ui/copy-markdown-button"
import type { Editor } from "@tiptap/react"
interface MainToolbarContentProps {
	editor: Editor | null
	onHighlighterClick: () => void
	onLinkClick: () => void
	isMobile: boolean
	isEditable: boolean
}

export const MainToolbarContent: React.FC<MainToolbarContentProps> = ({
	editor,
	onHighlighterClick,
	onLinkClick,
	isMobile,
	isEditable,
}) => {
	const { isVisible: isProjectImageVisible } = useProjectImage({
		editor,
		hideWhenUnavailable: true,
	})

	if (!isEditable) {
		return null
	}

	return (
		<>
			{/* <Spacer /> */}

			{/* <ToolbarGroup> */}
			<UndoRedoButton editor={editor} action="undo" disabled={!isEditable} />
			<UndoRedoButton editor={editor} action="redo" disabled={!isEditable} />
			{/* </ToolbarGroup> */}

			<ToolbarSeparator />

			{/* <ToolbarGroup> */}
			<HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
			<ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} portal={isMobile} />
			<BlockquoteButton editor={editor} />
			<CodeBlockButton editor={editor} />
			{/* </ToolbarGroup> */}

			<ToolbarSeparator />

			{/* <ToolbarGroup> */}
			<MarkButton editor={editor} type="bold" disabled={!isEditable} />
			<MarkButton editor={editor} type="italic" disabled={!isEditable} />
			<MarkButton type="strike" disabled={!isEditable} />
			<MarkButton editor={editor} type="code" disabled={!isEditable} />
			<MarkButton editor={editor} type="underline" disabled={!isEditable} />
			{!isMobile ? (
				<ColorHighlightPopover editor={editor} disabled={!isEditable} />
			) : (
				<ColorHighlightPopoverButton onClick={onHighlighterClick} disabled={!isEditable} />
			)}
			{!isMobile ? (
				<LinkPopover editor={editor} disabled={!isEditable} autoOpenOnLinkActive={false} />
			) : (
				<LinkButton onClick={onLinkClick} disabled={!isEditable} />
			)}
			{/* </ToolbarGroup> */}

			<ToolbarSeparator />

			{/* <ToolbarGroup> */}
			<MarkButton editor={editor} type="superscript" disabled={!isEditable} />
			<MarkButton editor={editor} type="subscript" disabled={!isEditable} />
			{/* </ToolbarGroup> */}

			<ToolbarSeparator />

			{/* <ToolbarGroup> */}
			<TextAlignButton editor={editor} align="left" disabled={!isEditable} />
			<TextAlignButton editor={editor} align="center" disabled={!isEditable} />
			<TextAlignButton editor={editor} align="right" disabled={!isEditable} />
			<TextAlignButton editor={editor} align="justify" disabled={!isEditable} />
			{/* </ToolbarGroup> */}

			<ToolbarSeparator />

			{/* <ToolbarGroup> */}
			<ProjectImageButton editor={editor} hideWhenUnavailable disabled={!isEditable} />
			{/* </ToolbarGroup> */}

			{isProjectImageVisible && <ToolbarSeparator />}

			{/* <ToolbarGroup> */}
			<CopyMarkdownButton editor={editor} disabled={!isEditable} />
			{/* </ToolbarGroup> */}

			{/* <Spacer /> */}

			{/* {isMobile && <ToolbarSeparator />} */}

			{/* <ToolbarGroup>
			<ThemeToggle />
		</ToolbarGroup> */}
		</>
	)
}
