import * as React from "react"
import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { IconGripVertical } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"

interface DragHandleButtonProps {
	editor: Editor
	targetPos: number | null
	targetNode: ProseMirrorNode | null
	onClick?: () => void
}

// Custom drag handle button component
export const DragHandleButton = React.memo<DragHandleButtonProps>(
	({ editor, targetPos, targetNode, onClick }) => {
		const { t } = useTranslation("tiptap")
		const deleteNode = useMemoizedFn(() => {
			if (targetPos !== null && targetNode) {
				editor
					.chain()
					.deleteRange({
						from: targetPos,
						to: targetPos + targetNode.nodeSize,
					})
					.focus()
					.run()
			}
		})

		const items = React.useMemo(() => {
			return [
				{
					key: "delete",
					label: t("toolbar.dragHandle.delete"),
					danger: true,
					onClick: deleteNode,
				},
			]
		}, [deleteNode, t])

		return (
			<MagicDropdown trigger={["click"]} menu={{ items }}>
				<button
					className="drag-handle-button"
					type="button"
					aria-label={t("editor.toolbar.dragHandle.ariaLabel")}
					title={t("editor.toolbar.dragHandle.title")}
					onClick={onClick}
				>
					<IconGripVertical size={18} />
				</button>
			</MagicDropdown>
		)
	},
)

DragHandleButton.displayName = "DragHandleButton"
