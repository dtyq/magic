import * as React from "react"
import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { IconPlus } from "@tabler/icons-react"
import {
	SlashDropdownMenuProps,
	SuggestionItem,
} from "@/opensource/components/tiptap-ui-primitive/SlashDropdownMenu"
import { SlashDropdownRenderer } from "@/opensource/components/tiptap-ui-primitive/SlashDropdownMenu/components"

interface SlashCommandTriggerButtonProps {
	editor: Editor
	targetPos: number | null
	targetNode: ProseMirrorNode | null
	config: SlashDropdownMenuProps["config"]
	onClick?: () => void
}

export const SlashCommandTriggerButton = React.memo<SlashCommandTriggerButtonProps>(
	({ editor, targetPos, targetNode, config, onClick }) => {
		const [open, setOpen] = React.useState(false)

		const triggerRef = React.useRef<HTMLButtonElement>(null)

		const handleSelect = (item: SuggestionItem) => {
			try {
				if (targetPos !== null && targetNode) {
					// Calculate the position after current node
					const afterPos = targetPos + targetNode.nodeSize

					// Force insert new paragraph after current node
					editor
						.chain()
						.insertContentAt(afterPos, {
							type: "paragraph",
							content: [],
						})
						.setTextSelection(afterPos + 1)
						.run()
				}

				// Execute item action at current cursor position
				item.onSelect({
					editor,
				})
			} catch (error) {
				console.error("[SlashCommand] Error executing item action:", error)
			}
		}

		return (
			<>
				<SlashDropdownRenderer
					open={open}
					onOpenChange={setOpen}
					editor={editor}
					range={{
						from: targetPos !== null ? targetPos + 1 : 0,
						to: targetPos !== null ? targetPos + 1 : 0,
					}}
					decorationNode={triggerRef.current}
					config={config}
					onSelect={handleSelect}
					onExit={() => {
						setOpen(false)
					}}
				/>
				<button
					ref={triggerRef}
					className="slash-command-trigger-button"
					type="button"
					onClick={() => {
						onClick?.()
						setOpen(true)
					}}
				>
					<IconPlus size={18} />
				</button>
			</>
		)
	},
)

SlashCommandTriggerButton.displayName = "SlashCommandTriggerButton"
