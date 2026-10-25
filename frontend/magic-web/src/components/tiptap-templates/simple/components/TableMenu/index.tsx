import * as React from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import {
	IconRowInsertTop,
	IconRowInsertBottom,
	IconColumnInsertLeft,
	IconColumnInsertRight,
	IconRowRemove,
	IconColumnRemove,
} from "@tabler/icons-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/tiptap-ui-primitive/tooltip"
import { isInTable, getTableCellCoordinates } from "./utils"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import "./table-menu.scss"

interface TableMenuProps {
	editor: Editor | null
	isEditable: boolean
}

export function TableMenu({ editor, isEditable }: TableMenuProps) {
	const { t } = useTranslation("tiptap")
	const [position, setPosition] = React.useState<{
		top: number
		left: number
	} | null>(null)
	const [isVisible, setIsVisible] = React.useState(false)

	// Check if cursor is in table and update position
	const updatePosition = useMemoizedFn(() => {
		if (!editor || !isEditable) {
			setIsVisible(false)
			return
		}

		const didUpdate = runActiveEditor(editor, (activeEditor) => {
			const inTable = isInTable(activeEditor)
			if (!inTable) {
				setIsVisible(false)
				return true
			}

			const coords = getTableCellCoordinates(activeEditor)
			if (!coords) {
				setIsVisible(false)
				return true
			}

			// Position menu above the cell
			setPosition({
				top: coords.top - 40,
				left: coords.left,
			})
			setIsVisible(true)
			return true
		})
		if (!didUpdate) setIsVisible(false)
	})

	// Update position on selection change
	React.useEffect(() => {
		if (!editor || !isEditable) return

		const handleUpdate = () => {
			updatePosition()
		}

		editor.on("selectionUpdate", handleUpdate)
		editor.on("update", handleUpdate)

		// Initial check
		updatePosition()

		return () => {
			editor.off("selectionUpdate", handleUpdate)
			editor.off("update", handleUpdate)
		}
	}, [editor, isEditable, updatePosition])

	// Update position on scroll
	React.useEffect(() => {
		if (!isVisible) return

		const handleScroll = () => {
			updatePosition()
		}

		window.addEventListener("scroll", handleScroll, true)
		return () => {
			window.removeEventListener("scroll", handleScroll, true)
		}
	}, [isVisible, updatePosition])

	// Table commands
	const addRowBefore = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().addRowBefore().run()
		})
	})

	const addRowAfter = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().addRowAfter().run()
		})
	})

	const addColumnBefore = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().addColumnBefore().run()
		})
	})

	const addColumnAfter = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().addColumnAfter().run()
		})
	})

	const deleteRow = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().deleteRow().run()
		})
	})

	const deleteColumn = useMemoizedFn(() => {
		runActiveEditor(editor, (activeEditor) => {
			activeEditor.chain().focus().deleteColumn().run()
		})
	})

	// Check if commands are available
	const canAddRowBefore =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().addRowBefore(), false) ?? false
	const canAddRowAfter =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().addRowAfter(), false) ?? false
	const canAddColumnBefore =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().addColumnBefore(), false) ??
		false
	const canAddColumnAfter =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().addColumnAfter(), false) ??
		false
	const canDeleteRow =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().deleteRow(), false) ?? false
	const canDeleteColumn =
		runActiveEditor(editor, (activeEditor) => activeEditor.can().deleteColumn(), false) ?? false

	if (!isVisible || !position) {
		return null
	}

	return createPortal(
		<div
			className="table-menu"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
		>
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={addRowBefore}
						disabled={!canAddRowBefore}
						aria-label={t("toolbar.tableMenu.addRowBefore")}
					>
						<IconRowInsertTop />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.addRowBefore")}</TooltipContent>
			</Tooltip>
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={addRowAfter}
						disabled={!canAddRowAfter}
						aria-label={t("toolbar.tableMenu.addRowAfter")}
					>
						<IconRowInsertBottom />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.addRowAfter")}</TooltipContent>
			</Tooltip>
			<div className="table-menu-separator" />
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={addColumnBefore}
						disabled={!canAddColumnBefore}
						aria-label={t("toolbar.tableMenu.addColumnBefore")}
					>
						<IconColumnInsertLeft />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.addColumnBefore")}</TooltipContent>
			</Tooltip>
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={addColumnAfter}
						disabled={!canAddColumnAfter}
						aria-label={t("toolbar.tableMenu.addColumnAfter")}
					>
						<IconColumnInsertRight />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.addColumnAfter")}</TooltipContent>
			</Tooltip>
			<div className="table-menu-separator" />
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={deleteRow}
						disabled={!canDeleteRow}
						aria-label={t("toolbar.tableMenu.deleteRow")}
					>
						<IconRowRemove />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.deleteRow")}</TooltipContent>
			</Tooltip>
			<Tooltip delay={200}>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="table-menu-button"
						onClick={deleteColumn}
						disabled={!canDeleteColumn}
						aria-label={t("toolbar.tableMenu.deleteColumn")}
					>
						<IconColumnRemove />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("toolbar.tableMenu.deleteColumn")}</TooltipContent>
			</Tooltip>
		</div>,
		document.body,
	)
}
