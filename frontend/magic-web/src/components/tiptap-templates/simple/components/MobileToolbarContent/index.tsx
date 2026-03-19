import * as React from "react"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { ToolbarGroup, ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar"
import { ColorHighlightPopoverContent } from "@/components/tiptap-ui/color-highlight-popover"
import { LinkContent } from "@/components/tiptap-ui/link-popover"
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

interface MobileToolbarContentProps {
	type: "highlighter" | "link"
	onBack: () => void
	isEditable: boolean
}

export const MobileToolbarContent: React.FC<MobileToolbarContentProps> = ({
	type,
	onBack,
	isEditable,
}) => {
	if (!isEditable) {
		return null
	}

	return (
		<>
			<ToolbarGroup>
				<Button data-style="ghost" onClick={onBack}>
					<ArrowLeftIcon className="tiptap-button-icon" />
					{type === "highlighter" ? (
						<HighlighterIcon className="tiptap-button-icon" />
					) : (
						<LinkIcon className="tiptap-button-icon" />
					)}
				</Button>
			</ToolbarGroup>

			<ToolbarSeparator />

			{type === "highlighter" ? <ColorHighlightPopoverContent /> : <LinkContent />}
		</>
	)
}
