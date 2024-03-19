import * as React from "react"
import type { Editor } from "@tiptap/react"
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
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/opensource/components/tiptap-ui-primitive/tooltip"
import { isInTable, getTableCellCoordinates } from "./utils"
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

		const inTable = isInTable(editor)
		if (!inTable) {
			setIsVisible(false)
			return
		}

		const coords = getTableCellCoordinates(editor)
		if (!coords) {
			setIsVisible(false)
			return
		}

		// Position menu above the cell
		setPosition({
			top: coords.top - 40,
			left: coords.left,
		})
		setIsVisible(true)
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
		if (!editor) return
		editor.chain().focus().addRowBefore().run()
	})

	const addRowAfter = useMemoizedFn(() => {
		if (!editor) return
		editor.chain().focus().addRowAfter().run()
	})

	const addColumnBefore = useMemoizedFn(() => {
		if (!editor) return
		editor.chain().focus().addColumnBefore().run()
	})

	const addColumnAfter = useMemoizedFn(() => {
		if (!editor) return
		editor.chain().focus().addColumnAfter().run()
	})

	const deleteRow = useMemoizedFn(() => {
		if (!editor) return
		editor.chain().focus().deleteRow().run()
	})

	const deleteColumn = useMemoizedFn(() => {
		if (!editor) return
		editor.chain().focus().deleteColumn().run()
	})

	// Check if commands are available
	const canAddRowBefore = editor?.can().addRowBefore() ?? false
	const canAddRowAfter = editor?.can().addRowAfter() ?? false
	const canAddColumnBefore = editor?.can().addColumnBefore() ?? false
	const canAddColumnAfter = editor?.can().addColumnAfter() ?? false
	const canDeleteRow = editor?.can().deleteRow() ?? false
	const canDeleteColumn = editor?.can().deleteColumn() ?? false

	if (!isVisible || !position) {
		return null
	}

	return (
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
				<TooltipContent>{t("tableMenu.deleteColumn")}</TooltipContent>
			</Tooltip>
		</div>
	)
}
