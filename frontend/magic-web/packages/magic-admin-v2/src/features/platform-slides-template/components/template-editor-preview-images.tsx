import { CheckCircle2, GripVertical, Plus, Trash2, UploadCloud } from "lucide-react"
import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core"
import {
	SortableContext,
	arrayMove,
	rectSortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"

type PreviewImageItem = {
	fileKey: string
	id: string
	url: string
}

type TemplateEditorPreviewImagesProps = {
	keys: string[]
	onChange: (keys: string[], urls: string[]) => void
	onUpload: (files: File[]) => void
	urls: string[]
}

function SortablePreviewImage({
	index,
	item,
	onRemove,
}: {
	index: number
	item: PreviewImageItem
	onRemove: (id: string) => void
}) {
	const { t } = useTranslation()
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
		id: item.id,
	})

	return (
		<div
			className={cn(
				"group relative aspect-video touch-none overflow-hidden rounded-md border bg-background shadow-sm outline-none transition-[border-color,box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-primary/30",
				isDragging && "z-10 opacity-0",
			)}
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				willChange: "transform",
			}}
			{...attributes}
			{...listeners}
		>
			<img
				alt={t("slidesTemplate.aria.previewImage", { index: index + 1 })}
				className="size-full select-none object-contain"
				draggable={false}
				src={item.url}
			/>
			<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
				<span>#{index + 1}</span>
				<GripVertical className="size-4" />
			</div>
			<button data-testid="platform-slides-template-preview-image-button"
				aria-label={t("slidesTemplate.aria.removePreviewImage", {
					index: index + 1,
				})}
				className="absolute right-1 top-1 rounded bg-background/90 p-1 text-destructive opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
				onClick={(event) => {
					event.stopPropagation()
					onRemove(item.id)
				}}
				onPointerDown={(event) => event.stopPropagation()}
				type="button"
			>
				<Trash2 className="size-3.5" />
			</button>
		</div>
	)
}

function PreviewImageDragOverlay({ item }: { item: PreviewImageItem }) {
	const { t } = useTranslation()
	return (
		<div className="aspect-video w-40 rotate-1 overflow-hidden rounded-md border border-primary/40 bg-background p-1 shadow-2xl ring-2 ring-primary/20">
			<img
				alt={t("slidesTemplate.aria.draggingPreviewImage")}
				className="size-full select-none object-contain"
				draggable={false}
				src={item.url}
			/>
		</div>
	)
}

/** 预览图上传、删除和拖拽排序区域；file key 与 URL 始终同步变更。 */
export function TemplateEditorPreviewImages({
	keys,
	onChange,
	onUpload,
	urls,
}: TemplateEditorPreviewImagesProps) {
	const { t } = useTranslation()
	const [activeId, setActiveId] = useState<string | null>(null)
	const [draggingFiles, setDraggingFiles] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const items = useMemo<PreviewImageItem[]>(
		() =>
			urls.map((url, index) => ({
				fileKey: keys[index] ?? "",
				id: `preview:${keys[index] || url}`,
				url,
			})),
		[keys, urls],
	)
	const activeItem = items.find((item) => item.id === activeId)
	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!Array.from(event.dataTransfer.types).includes("Files")) return
		event.preventDefault()
		event.dataTransfer.dropEffect = "copy"
		setDraggingFiles(true)
	}
	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
		setDraggingFiles(false)
	}
	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.files.length) return
		event.preventDefault()
		setDraggingFiles(false)
		onUpload(Array.from(event.dataTransfer.files))
	}
	const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
		if (!event.clipboardData.files.length) return
		event.preventDefault()
		onUpload(Array.from(event.clipboardData.files))
	}
	const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))
	const handleDragEnd = (event: DragEndEvent) => {
		setActiveId(null)
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = items.findIndex((item) => item.id === active.id)
		const newIndex = items.findIndex((item) => item.id === over.id)
		if (oldIndex < 0 || newIndex < 0) return
		const nextItems = arrayMove(items, oldIndex, newIndex)
		onChange(
			nextItems.map((item) => item.fileKey),
			nextItems.map((item) => item.url),
		)
	}

	return (
		<div
			className={cn(
				"space-y-3 rounded-lg border border-dashed p-3 transition-[border-color,background-color,box-shadow] duration-200",
				draggingFiles
					? "border-primary bg-primary/5 ring-2 ring-primary/15"
					: items.length > 0
						? "border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/15"
						: "border-border bg-muted/10",
			)}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			onPaste={handlePaste}
			tabIndex={0}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1.5">
					<span className="block text-sm font-medium">
						{t("slidesTemplate.form.previews")}
					</span>
					{items.length > 0 ? (
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
							<span className="inline-flex items-center gap-1 font-medium">
								<CheckCircle2 className="size-3.5" />
								{t("slidesTemplate.form.uploadSuccess")}
							</span>
							<span>
								{t("slidesTemplate.form.previewImagesUploadedHint", {
									count: items.length,
								})}
							</span>
						</div>
					) : (
						<p className="text-xs text-muted-foreground">
							{t("slidesTemplate.form.previewImagesUploadHint")}
						</p>
					)}
				</div>
				<Button onClick={() => inputRef.current?.click()} size="sm" variant="outline" data-testid="platform-slides-template-upload-button">
					<Plus className="mr-1 size-4" />
					{t(
						items.length > 0
							? "slidesTemplate.form.continueUpload"
							: "slidesTemplate.form.uploadImages",
					)}
				</Button>
			</div>
			<input data-testid="platform-slides-template-preview-input"
				accept="image/*"
				className="hidden"
				multiple
				onChange={(event) => {
					if (event.target.files) onUpload(Array.from(event.target.files))
					event.target.value = ""
				}}
				ref={inputRef}
				type="file"
			/>
			<DndContext
				collisionDetection={closestCenter}
				onDragCancel={() => setActiveId(null)}
				onDragEnd={handleDragEnd}
				onDragStart={handleDragStart}
				sensors={sensors}
			>
				<SortableContext
					items={items.map((item) => item.id)}
					strategy={rectSortingStrategy}
				>
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
						{items.map((item, index) => (
							<SortablePreviewImage
								index={index}
								item={item}
								key={item.id}
								onRemove={(id) => {
									const nextItems = items.filter((current) => current.id !== id)
									onChange(
										nextItems.map((current) => current.fileKey),
										nextItems.map((current) => current.url),
									)
								}}
							/>
						))}
						<button data-testid="platform-slides-template-preview-remove-button"
							aria-label={t("slidesTemplate.aria.addPreviewImages")}
							className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-background/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-background hover:text-primary"
							onClick={() => inputRef.current?.click()}
							type="button"
						>
							<UploadCloud className="size-5" />
						</button>
					</div>
				</SortableContext>
				<DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
					{activeItem ? <PreviewImageDragOverlay item={activeItem} /> : null}
				</DragOverlay>
			</DndContext>
		</div>
	)
}
