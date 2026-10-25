import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	DndContext,
	DragOverlay,
	MeasuringStrategy,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	pointerWithin,
	rectIntersection,
	useDroppable,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type DragStartEvent,
	type Modifier,
} from "@dnd-kit/core"
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
	ArrowDown,
	ArrowUp,
	Eye,
	EyeOff,
	GripVertical,
	ListOrdered,
	Play,
	Plus,
	Redo2,
	Square,
	Undo2,
	X,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import { useSelectedElement } from "../StylePanel/hooks/useSelectedElement"
import {
	appendBuildStep,
	appendBuildStepGroup,
	AUTO_DELAY_OPTIONS_MS,
	groupAutoDelay,
	groupBuildQueue,
	NEW_STEP_DROP_ID,
	reorderBuildQueue,
	resolveItemDrop,
	setGroupAutoDelay,
} from "./buildQueue"
import { usePPTBuildPlayPreview } from "./usePPTBuildPlayPreview"
import { usePPTBuildQueue } from "./usePPTBuildQueue"
import { PPTBuildQueueItem } from "./PPTBuildQueueItem"

export const PPTBuildPanel = observer(function PPTBuildPanel({
	editorRef,
	contentRevision,
	disabled,
	onClose,
	onCommit,
}: {
	editorRef: RefObject<HTMLEditorV2Ref>
	contentRevision: number
	disabled?: boolean
	onClose: () => void
	onCommit?: () => Promise<boolean>
}) {
	const { t } = useTranslation("super")
	const { selectedElement } = useSelectedElement(editorRef)
	const stylePanelStore = useStylePanelStore()
	const { historyState } = stylePanelStore
	const { entries, loading, busy, failed, update, travel, reload } = usePPTBuildQueue(
		editorRef,
		contentRevision,
		onCommit,
	)
	const groups = groupBuildQueue(entries)
	const { playing, play, stop } = usePPTBuildPlayPreview(
		editorRef,
		groups.map((group) => groupAutoDelay(group.items)),
	)
	// While the preview plays the queue is read-only; only stopping it is allowed.
	const locked = disabled || busy || loading || failed || playing
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	// Display number of the step the canvas is previewed up to; null shows the full page.
	const [previewSteps, setPreviewSteps] = useState<number | null>(null)
	const togglePreview = (steps: number) => {
		if (playing) void stop()
		const next = previewSteps === steps ? null : steps
		setPreviewSteps(next)
		void editorRef.current?.previewPPTBuild(next).catch(() => setPreviewSteps(null))
	}
	// Any queue change (edit, undo, reload) invalidates what the preview showed.
	useEffect(() => {
		setPreviewSteps(null)
		void stop()
	}, [entries, stop])
	useEffect(
		() => () => {
			void editorRef.current?.previewPPTBuild(null).catch(() => {
				/* The iframe may already have been disposed. */
			})
		},
		[editorRef],
	)
	const selected = entries.find((entry) => entry.selector === selectedElement?.selector)
	// Shift-click on the canvas selects several elements; they become one step together.
	const pendingSelectors = stylePanelStore
		.getSelectedSelectors()
		.filter((selector) => !entries.some((entry) => entry.selector === selector))
	const move = (from: number, to: number) => void update(reorderBuildQueue(entries, from, to))
	const [activeDrag, setActiveDrag] = useState<
		{ type: "item"; selector: string } | { type: "group"; step: number } | null
	>(null)
	const draggingItem = activeDrag?.type === "item"
	const onDragStart = ({ active }: DragStartEvent) => {
		const data = active.data.current
		if (data?.type === "item")
			setActiveDrag({ type: "item", selector: data.selector as string })
		else if (typeof active.id === "number") setActiveDrag({ type: "group", step: active.id })
	}
	// Moving an element is aimed with the pointer; reordering whole steps keeps sorting behavior.
	const collisionDetection: CollisionDetection = (args) => {
		if (args.active.data.current?.type !== "item") return closestCenter(args)
		const hits = pointerWithin(args)
		return hits.length ? hits : rectIntersection(args)
	}
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveDrag(null)
		if (!over || active.id === over.id || locked) return
		const data = active.data.current
		if (data?.type === "item") {
			const updates = resolveItemDrop(entries, data.selector as string, over.id)
			if (updates.length) void update(updates)
			return
		}
		const from = groups.findIndex((group) => group.step === active.id)
		const to = groups.findIndex((group) => group.step === over.id)
		if (from >= 0 && to >= 0) move(from, to)
	}
	const select = (selector: string) => {
		void editorRef.current?.selectElement(selector).catch(() => {
			void reload()
		})
	}
	return (
		<aside
			aria-label={t("ppt.build.title")}
			data-testid="ppt-build-panel"
			className="flex min-h-0 w-72 max-w-[45%] shrink-0 flex-col border-l border-border bg-background max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:max-w-[85%] max-md:shadow-lg"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border p-3">
				<h3 className="flex items-center gap-2 text-sm font-medium">
					<ListOrdered size={16} /> {t("ppt.build.title")}
				</h3>
				<div className="flex items-center gap-0.5">
					<MagicTooltip
						title={playing ? t("ppt.build.stopPlayback") : t("ppt.build.playPreview")}
					>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							aria-label={
								playing ? t("ppt.build.stopPlayback") : t("ppt.build.playPreview")
							}
							data-testid="ppt-build-play"
							disabled={!playing && (locked || !groups.length)}
							onClick={() => {
								setPreviewSteps(null)
								void (playing ? stop() : play())
							}}
						>
							{playing ? <Square size={14} /> : <Play size={16} />}
						</Button>
					</MagicTooltip>
					{[
						{
							key: "undo" as const,
							icon: Undo2,
							label: t("ppt.build.undo"),
							enabled: historyState.canUndo,
						},
						{
							key: "redo" as const,
							icon: Redo2,
							label: t("ppt.build.redo"),
							enabled: historyState.canRedo,
						},
					].map(({ key, icon: Icon, label, enabled }) => (
						<MagicTooltip key={key} title={label}>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								aria-label={label}
								data-testid={`ppt-build-${key}`}
								disabled={locked || !enabled}
								onClick={() => void travel(key)}
							>
								<Icon size={16} />
							</Button>
						</MagicTooltip>
					))}
					<MagicTooltip title={t("ppt.build.close")}>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							aria-label={t("ppt.build.close")}
							onClick={onClose}
							disabled={busy || disabled}
						>
							<X size={16} />
						</Button>
					</MagicTooltip>
				</div>
			</div>
			<div className="space-y-2 border-b border-border p-3">
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					disabled={locked || !pendingSelectors.length || groups.length >= 1000}
					onClick={() => void update(appendBuildStepGroup(entries, pendingSelectors))}
				>
					<Plus size={16} />{" "}
					{pendingSelectors.length > 1
						? t("ppt.build.addSelectedMany", { count: pendingSelectors.length })
						: t("ppt.build.addSelected")}
				</Button>
				<p className="text-xs text-muted-foreground">
					{pendingSelectors.length > 1
						? t("ppt.build.manySelected")
						: selected
							? t("ppt.build.alreadyAdded")
							: t("ppt.build.pickElement")}
				</p>
			</div>
			<ScrollArea className="min-h-0 flex-1" viewportClassName="p-3 [&>div]:!block">
				{loading ? (
					<p role="status" className="text-xs text-muted-foreground">
						{t("ppt.build.loading")}
					</p>
				) : failed ? (
					<div role="alert" className="space-y-2 text-xs">
						<p>{t("ppt.build.loadFailed")}</p>
						<Button variant="outline" size="sm" onClick={() => void reload()}>
							{t("ppt.build.retry")}
						</Button>
					</div>
				) : !groups.length ? (
					<p className="py-6 text-center text-xs text-muted-foreground">
						{t("ppt.build.empty")}
					</p>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={collisionDetection}
						measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
						onDragStart={onDragStart}
						onDragCancel={() => setActiveDrag(null)}
						onDragEnd={onDragEnd}
					>
						<SortableContext
							items={groups.map((group) => group.step)}
							strategy={verticalListSortingStrategy}
						>
							<ol
								className="space-y-3"
								aria-label={t("ppt.build.queue")}
								aria-busy={busy}
							>
								{groups.map((group, index) => (
									<SortableStep
										key={group.step}
										id={group.step}
										locked={locked}
										itemDropActive={draggingItem}
										label={t("ppt.build.stepLabel", { step: index + 1 })}
										preview={{
											label:
												previewSteps === index + 1
													? t("ppt.build.stopPreview")
													: t("ppt.build.previewStep"),
											active: previewSteps === index + 1,
											disabled: locked,
											onClick: () => togglePreview(index + 1),
										}}
										moveUp={{
											label: t("ppt.build.moveUp"),
											disabled: locked || index <= 0,
											onClick: () => move(index, index - 1),
										}}
										moveDown={{
											label: t("ppt.build.moveDown"),
											disabled: locked || index >= groups.length - 1,
											onClick: () => move(index, index + 1),
										}}
									>
										<StepTrigger
											disabled={locked}
											delay={groupAutoDelay(group.items)}
											onChange={(delay) =>
												void update(setGroupAutoDelay(group.items, delay))
											}
										/>
										<ul className="space-y-1 p-1">
											{group.items.map((entry) => (
												<PPTBuildQueueItem
													key={entry.selector}
													entry={entry}
													entries={entries}
													selected={
														entry.selector === selectedElement?.selector
													}
													disabled={locked}
													delayedUntilStep={
														entry.ancestorStep !== undefined &&
														entry.ancestorStep > entry.build.step
															? groups.findIndex(
																	(item) =>
																		item.step ===
																		entry.ancestorStep,
																) + 1 || undefined
															: undefined
													}
													onSelect={select}
													onUpdate={update}
												/>
											))}
										</ul>
									</SortableStep>
								))}
							</ol>
						</SortableContext>
						<NewStepDropZone active={draggingItem} label={t("ppt.build.dropNewStep")} />
						<DragOverlay
							dropAnimation={{ duration: 160 }}
							modifiers={activeDrag?.type === "group" ? [lockHorizontal] : undefined}
						>
							{activeDrag?.type === "item" ? (
								<DragPreview
									title={
										entries.find(
											(entry) => entry.selector === activeDrag.selector,
										)?.label ?? ""
									}
								/>
							) : activeDrag?.type === "group" ? (
								<DragPreview
									title={t("ppt.build.stepLabel", {
										step:
											groups.findIndex(
												(group) => group.step === activeDrag.step,
											) + 1,
									})}
								/>
							) : null}
						</DragOverlay>
					</DndContext>
				)}
			</ScrollArea>
			<p className="border-t border-border p-3 text-xs text-muted-foreground" role="status">
				{busy ? t("ppt.build.updating") : t("ppt.build.queueHint")}
			</p>
		</aside>
	)
})

interface StepAction {
	label: string
	disabled: boolean
	onClick: () => void
}

function SortableStep({
	id,
	locked,
	itemDropActive,
	label,
	preview,
	moveUp,
	moveDown,
	children,
}: {
	id: number
	locked: boolean
	/** An element is being dragged: highlight the step it would land in. */
	itemDropActive: boolean
	label: string
	preview: StepAction & { active: boolean }
	moveUp: StepAction
	moveDown: StepAction
	children: ReactNode
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
		isOver,
	} = useSortable({ id, disabled: locked, data: { type: "group" } })
	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"relative rounded-md border border-border bg-background transition-shadow",
				// The source stays in the list as the drop placeholder while a preview follows the pointer.
				isDragging && "border-dashed bg-muted/40 [&>*]:opacity-30",
				itemDropActive && isOver && "border-primary ring-2 ring-primary/40",
			)}
		>
			<div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1">
				<button
					type="button"
					ref={setActivatorNodeRef}
					disabled={locked}
					className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={label}
					{...attributes}
					{...listeners}
				>
					<GripVertical size={16} />
				</button>
				<span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
				{[
					{ icon: preview.active ? EyeOff : Eye, action: preview },
					{ icon: ArrowUp, action: moveUp },
					{ icon: ArrowDown, action: moveDown },
				].map(({ icon: Icon, action }) => (
					<MagicTooltip key={action.label} title={action.label}>
						<Button
							variant="ghost"
							size="icon"
							className="size-7 shrink-0"
							aria-label={action.label}
							disabled={action.disabled}
							onClick={action.onClick}
						>
							<Icon size={16} />
						</Button>
					</MagicTooltip>
				))}
			</div>
			{children}
		</li>
	)
}

function NewStepDropZone({ label, active }: { label: string; active: boolean }) {
	const { setNodeRef, isOver } = useDroppable({ id: NEW_STEP_DROP_ID })
	return (
		// Space is always reserved so the list does not jump when a drag starts.
		<div
			ref={setNodeRef}
			aria-hidden={!active}
			className={cn(
				"mt-3 flex h-12 items-center justify-center rounded-md border border-dashed text-xs transition-opacity",
				active ? "opacity-100" : "pointer-events-none opacity-0",
				isOver
					? "border-primary bg-accent text-foreground"
					: "border-border text-muted-foreground",
			)}
		>
			{label}
		</div>
	)
}

function DragPreview({ title }: { title: string }) {
	return (
		<div className="max-w-64 truncate rounded-md border border-primary bg-background px-3 py-2 text-sm shadow-lg">
			{title}
		</div>
	)
}

const lockHorizontal: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function StepTrigger({
	delay,
	disabled,
	onChange,
}: {
	delay: number | null
	disabled: boolean
	onChange: (delay: number | null) => void
}) {
	const { t } = useTranslation("super")
	// An agent or hand-edited delay outside the presets still has to display correctly.
	const options =
		delay === null || AUTO_DELAY_OPTIONS_MS.includes(delay)
			? AUTO_DELAY_OPTIONS_MS
			: [...AUTO_DELAY_OPTIONS_MS, delay].sort((a, b) => a - b)
	return (
		<label className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs">
			<span className="shrink-0 text-muted-foreground">{t("ppt.build.trigger")}</span>
			<select
				value={delay === null ? "click" : String(delay)}
				disabled={disabled}
				className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1"
				onChange={(event) =>
					onChange(event.target.value === "click" ? null : Number(event.target.value))
				}
			>
				<option value="click">{t("ppt.build.triggerClick")}</option>
				{options.map((ms) => (
					<option key={ms} value={ms}>
						{ms === 0
							? t("ppt.build.triggerAutoNow")
							: t("ppt.build.triggerAuto", { seconds: ms / 1000 })}
					</option>
				))}
			</select>
		</label>
	)
}
