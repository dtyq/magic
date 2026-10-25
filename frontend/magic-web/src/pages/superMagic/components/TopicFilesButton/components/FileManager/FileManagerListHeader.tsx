import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react"
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import type { useFileManagerColumns } from "../../hooks/useFileManagerColumns"
import type { FilePresentation } from "../../utils/file-presentation"
import type { FileManagerSort, FileManagerSortDirection, FileManagerTreeRow } from "./types"

interface Props {
	columns: ReturnType<typeof useFileManagerColumns>
	sort: FileManagerSort
	direction: FileManagerSortDirection
	onSort: (id: FileManagerSort, toggle?: boolean) => void
	items: FilePresentation[]
	rowDetails: ReadonlyMap<string, FileManagerTreeRow>
	getText: (file: FilePresentation, id: FileManagerSort) => string
	getPopupContainer: () => HTMLElement | null
	isActive: boolean
}

export function FileManagerListHeader(props: Props) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const gesture = useRef<{
		id: FileManagerSort
		x: number
		before: number
		width: number
		button: HTMLButtonElement
		pointerId: number
	} | null>(null)
	const finish = useMemoizedFn((cancel = false) => {
		const current = gesture.current
		gesture.current = null
		if (!current) return
		if (current.button.hasPointerCapture(current.pointerId))
			current.button.releasePointerCapture(current.pointerId)
		if (cancel || current.width === current.before) props.columns.cancelPreview()
		else props.columns.setWidth(current.id, current.width)
	})
	useEffect(() => {
		if (!props.isActive) {
			finish(true)
			setOpen(false)
		}
		return () => finish(true)
	}, [props.isActive, finish])
	const start = (event: PointerEvent<HTMLButtonElement>, id: FileManagerSort) => {
		if (event.button !== 0) return
		event.preventDefault()
		event.stopPropagation()
		const width = event.currentTarget.parentElement?.getBoundingClientRect().width
		if (!width) return
		finish(true)
		gesture.current = {
			id,
			x: event.clientX,
			before: width,
			width,
			button: event.currentTarget,
			pointerId: event.pointerId,
		}
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const move = (event: PointerEvent<HTMLButtonElement>) => {
		const current = gesture.current
		if (!current) return
		current.width = props.columns.clampWidth(
			current.id,
			current.before + event.clientX - current.x,
		)
		props.columns.previewWidth(current.id, current.width)
	}
	const fit = (button: HTMLButtonElement, id: FileManagerSort) => {
		const context = document.createElement("canvas").getContext("2d")
		if (!context || !button.parentElement) return
		context.font = getComputedStyle(button.parentElement).font
		let width = context.measureText(props.columns.labels[id]).width + 40
		// 只在明确双击时测量当前已加载的列表序列，不读取隐藏子树或文件正文。
		for (const file of props.items) {
			const inset =
				id === "name"
					? 56 + (props.rowDetails.get(file.item.file_id ?? "")?.level ?? 0) * 16
					: 16
			width = Math.max(width, context.measureText(props.getText(file, id)).width + inset)
		}
		props.columns.setWidth(id, width)
	}
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: FileManagerSort) => {
		if (event.key === "Escape") {
			event.preventDefault()
			event.stopPropagation()
			finish(true)
			return
		}
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
		event.preventDefault()
		event.stopPropagation()
		const width = event.currentTarget.parentElement?.getBoundingClientRect().width
		if (width) props.columns.setWidth(id, width + (event.key === "ArrowLeft" ? -10 : 10))
	}
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<div
				className="shrink-0 border-b bg-muted/20 px-[10px] text-xs text-muted-foreground"
				onContextMenu={(event) => {
					event.preventDefault()
					event.stopPropagation()
					setOpen(true)
				}}
			>
				<div
					className="grid px-3"
					style={{ gridTemplateColumns: "var(--manager-columns)" }}
				>
					{props.columns.visible.map(({ id }) => (
						<div
							key={id}
							role="columnheader"
							aria-sort={props.sort === id ? props.direction : "none"}
							className="relative flex min-w-0 items-center px-2 py-1.5"
						>
							<button
								type="button"
								className="flex min-w-0 cursor-pointer items-center gap-1 rounded-sm outline-none focus-visible:bg-muted"
								onClick={() => props.onSort(id, true)}
							>
								<span className="truncate">{props.columns.labels[id]}</span>
								{props.sort === id &&
									(props.direction === "ascending" ? (
										<ArrowUp size={12} className="shrink-0" />
									) : (
										<ArrowDown size={12} className="shrink-0" />
									))}
							</button>
							{id === "name" && (
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										aria-label={t("fileManager.columns.show")}
										className="ml-auto cursor-pointer rounded p-0.5 outline-none hover:bg-muted focus-visible:bg-muted"
									>
										<Columns3 size={14} />
									</button>
								</DropdownMenuTrigger>
							)}
							<button
								type="button"
								aria-label={t("fileManager.columns.resize", {
									name: props.columns.labels[id],
								})}
								className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none"
								onPointerDown={(event) => start(event, id)}
								onPointerMove={move}
								onPointerUp={() => finish()}
								onPointerCancel={() => finish(true)}
								onLostPointerCapture={() => finish(true)}
								onDoubleClick={(event) => fit(event.currentTarget, id)}
								onKeyDown={(event) => onKeyDown(event, id)}
							>
								<span
									aria-hidden
									className="absolute inset-y-1 left-1/2 w-px bg-border group-hover:bg-blue-500 group-focus-visible:bg-blue-500"
								/>
							</button>
						</div>
					))}
				</div>
			</div>
			<DropdownMenuContent container={props.getPopupContainer()} align="end">
				{props.columns.columns.map(({ id }) => (
					<DropdownMenuCheckboxItem
						key={id}
						className="cursor-pointer data-[disabled]:cursor-not-allowed"
						checked={props.columns.visibleIds.includes(id)}
						disabled={id === "name"}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={() => props.columns.toggle(id)}
					>
						{props.columns.labels[id]}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
