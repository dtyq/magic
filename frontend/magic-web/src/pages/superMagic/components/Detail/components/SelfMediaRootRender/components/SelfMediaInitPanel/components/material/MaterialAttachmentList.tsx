import { useCallback, useRef, useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/utils/cn"
import projectFilesStore from "@/stores/projectFiles"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
} from "@/components/shadcn-ui/dropdown-menu"
import ProjectFilePickerContent from "../picker/ProjectFilePickerContent"
import { selfMediaOverlayStyles } from "../../../selfMediaOverlayStyles"
import { useDropZone } from "../../lib/useDropZone"
import type { DropPayload, SelfMediaProjectFileRef } from "../../lib/projectFileDrag"
import type { MaterialItem } from "../../types"
import MaterialAttachmentRow from "./MaterialAttachmentRow"
import MaterialUploadTrigger from "./MaterialUploadTrigger"

const ACCEPT_TYPES = "image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
const MATERIAL_VIRTUAL_THRESHOLD = 8
const COMPACT_ROW_HEIGHT = 72
const FULL_ROW_HEIGHT = 96

function generateId(): string {
	return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

interface MaterialAttachmentListProps {
	materials: MaterialItem[]
	onChange: (materials: MaterialItem[]) => void
	compact?: boolean
	className?: string
	addLabel?: string
	descriptionPlaceholder?: string
	emptyHint?: string
	/** Enable picking files from the project workspace alongside local upload */
	enableProjectPicker?: boolean
	/** When provided, local files are uploaded to the project immediately after being added. Receives (file, materialId). */
	uploadToProject?: (file: File, materialId: string) => void
}

export default function MaterialAttachmentList({
	materials,
	onChange,
	compact = false,
	className,
	addLabel,
	descriptionPlaceholder,
	emptyHint,
	enableProjectPicker = false,
	uploadToProject,
}: MaterialAttachmentListProps) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const inputRef = useRef<HTMLInputElement>(null)
	const [showProjectPicker, setShowProjectPicker] = useState(false)
	const [loadingProjectFile, setLoadingProjectFile] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [pendingProjectFiles, setPendingProjectFiles] = useState<
		Map<string, { fileId: string; fileName: string; filePath?: string }>
	>(() => new Map())

	const handleFiles = useCallback(
		(fileList: FileList | null) => {
			if (!fileList || fileList.length === 0) return

			const newItems: MaterialItem[] = Array.from(fileList).map((file) => {
				// Add timestamp to filename to avoid overwriting when pasting multiple times
				const dotIndex = file.name.lastIndexOf(".")
				const uniqueName =
					dotIndex > 0
						? `${file.name.slice(0, dotIndex)}_${Date.now()}${file.name.slice(dotIndex)}`
						: `${file.name}_${Date.now()}`
				const renamedFile = new File([file], uniqueName, {
					type: file.type,
					lastModified: file.lastModified,
				})
				return {
					id: generateId(),
					file: renamedFile,
					previewUrl: renamedFile.type.startsWith("image/")
						? URL.createObjectURL(renamedFile)
						: "",
					description: "",
				}
			})

			onChange([...materials, ...newItems])

			// Upload to project in background if callback is provided
			if (uploadToProject) {
				for (const item of newItems) {
					uploadToProject(item.file, item.id)
				}
			}
		},
		[materials, onChange, uploadToProject],
	)

	const handleRemove = useCallback(
		(id: string) => {
			const item = materials.find((m) => m.id === id)
			if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
			onChange(materials.filter((m) => m.id !== id))
		},
		[materials, onChange],
	)

	const handleDescriptionChange = useCallback(
		(id: string, description: string) => {
			onChange(materials.map((m) => (m.id === id ? { ...m, description } : m)))
		},
		[materials, onChange],
	)

	const selectedPaths = useMemo(
		() => new Set(materials.map((item) => item.uploadedPath).filter((p): p is string => !!p)),
		[materials],
	)

	const addProjectFileRefs = useCallback(
		async (refs: SelfMediaProjectFileRef[]) => {
			const pending = refs.filter((ref) => !ref.filePath || !selectedPaths.has(ref.filePath))
			if (pending.length === 0) return

			setLoadingProjectFile(true)
			try {
				const newItems = await Promise.all(
					pending.map(async ({ fileId, fileName, filePath }) => {
						const blob = (await fileApi.getFileContentById(fileId, {
							responseType: "blob",
						})) as Blob
						const file = new File([blob], fileName, { type: blob.type })
						const previewUrl = file.type.startsWith("image/")
							? URL.createObjectURL(file)
							: ""
						return {
							id: generateId(),
							file,
							previewUrl,
							description: "",
							uploadedPath: filePath,
						} satisfies MaterialItem
					}),
				)
				onChange([...materials, ...newItems])
				setShowProjectPicker(false)
				setSearchQuery("")
				setPendingProjectFiles(new Map())
			} catch (err) {
				console.error("Failed to load project files:", err)
			} finally {
				setLoadingProjectFile(false)
			}
		},
		[materials, onChange, selectedPaths, fileApi],
	)

	const handleDropPayload = useCallback(
		(payload: DropPayload) => {
			if (payload.kind === "local") {
				const dt = new DataTransfer()
				payload.files.forEach((file) => dt.items.add(file))
				handleFiles(dt.files)
				return
			}
			void addProjectFileRefs(payload.files)
		},
		[addProjectFileRefs, handleFiles],
	)

	const { isDragging, dropZoneProps } = useDropZone({
		disabled: loadingProjectFile,
		onDropPayload: handleDropPayload,
	})

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const clipboardData = e.clipboardData
			if (!clipboardData) return

			// Try to get files directly from clipboard
			if (clipboardData.files && clipboardData.files.length > 0) {
				e.preventDefault()
				handleFiles(clipboardData.files)
				return
			}

			// Fallback: extract files from clipboard items (e.g., pasted screenshots)
			const items = clipboardData.items
			if (!items) return

			const files: File[] = []
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (item.kind === "file") {
					const file = item.getAsFile()
					if (file) files.push(file)
				}
			}

			if (files.length > 0) {
				e.preventDefault()
				const dt = new DataTransfer()
				files.forEach((f) => dt.items.add(f))
				handleFiles(dt.files)
			}
		},
		[handleFiles],
	)

	// Also listen for document-level paste when the dropdown is open
	useEffect(() => {
		if (!showProjectPicker) return
		const handler = (e: ClipboardEvent) => {
			const activeEl = document.activeElement
			if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA") return

			const clipboardData = e.clipboardData
			if (!clipboardData) return

			const files: File[] = []
			if (clipboardData.files && clipboardData.files.length > 0) {
				files.push(...Array.from(clipboardData.files))
			} else if (clipboardData.items) {
				for (let i = 0; i < clipboardData.items.length; i++) {
					const item = clipboardData.items[i]
					if (item.kind === "file") {
						const file = item.getAsFile()
						if (file) files.push(file)
					}
				}
			}

			if (files.length > 0) {
				e.preventDefault()
				const dt = new DataTransfer()
				files.forEach((f) => dt.items.add(f))
				handleFiles(dt.files)
				setShowProjectPicker(false)
				setSearchQuery("")
			}
		}
		document.addEventListener("paste", handler)
		return () => document.removeEventListener("paste", handler)
	}, [showProjectPicker, handleFiles])

	const projectFiles = useMemo(
		() =>
			enableProjectPicker
				? projectFilesStore.workspaceFilesList.filter((f) => !f.is_directory)
				: [],
		[enableProjectPicker],
	)

	const filteredProjectFiles = useMemo(() => {
		if (!searchQuery.trim()) return projectFiles
		const query = searchQuery.toLowerCase()
		return projectFiles.filter(
			(f) =>
				(f.display_filename || f.file_name || "").toLowerCase().includes(query) ||
				(f.relative_file_path || "").toLowerCase().includes(query),
		)
	}, [projectFiles, searchQuery])

	const handleProjectFileSelect = useCallback(
		async (fileId: string, fileName: string, relativePath?: string) => {
			if (relativePath && selectedPaths.has(relativePath)) {
				setShowProjectPicker(false)
				setSearchQuery("")
				return
			}

			setLoadingProjectFile(true)
			try {
				const blob = (await fileApi.getFileContentById(fileId, {
					responseType: "blob",
				})) as Blob
				const file = new File([blob], fileName, { type: blob.type })
				const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
				const newItem: MaterialItem = {
					id: generateId(),
					file,
					previewUrl,
					description: "",
					uploadedPath: relativePath,
				}
				onChange([...materials, newItem])
				setShowProjectPicker(false)
				setSearchQuery("")
				setPendingProjectFiles(new Map())
			} catch (err) {
				console.error("Failed to load project file:", err)
			} finally {
				setLoadingProjectFile(false)
			}
		},
		[materials, onChange, selectedPaths, fileApi],
	)

	const handleProjectFileToggle = useCallback(
		(fileId: string, fileName: string, filePath?: string) => {
			if (filePath && selectedPaths.has(filePath)) return

			setPendingProjectFiles((prev) => {
				const next = new Map(prev)
				if (next.has(fileId)) {
					next.delete(fileId)
				} else {
					next.set(fileId, { fileId, fileName, filePath })
				}
				return next
			})
		},
		[selectedPaths],
	)

	const handleConfirmProjectFiles = useCallback(async () => {
		if (pendingProjectFiles.size === 0) return
		await addProjectFileRefs(Array.from(pendingProjectFiles.values()))
	}, [addProjectFileRefs, pendingProjectFiles])

	const handleOpenChange = useCallback((open: boolean) => {
		setShowProjectPicker(open)
		if (!open) {
			setSearchQuery("")
			setPendingProjectFiles(new Map())
		}
	}, [])

	const handleLocalUpload = useCallback(() => {
		inputRef.current?.click()
		setShowProjectPicker(false)
		setSearchQuery("")
	}, [])

	const uploadLabel =
		addLabel ||
		t(
			compact
				? "detail.selfMedia.initPanel.materialAttachment.addCompact"
				: "detail.selfMedia.initPanel.materialAttachment.addFull",
			compact ? "添加附件" : "点击、拖拽或粘贴上传附件",
		)
	const resolvedDescriptionPlaceholder =
		descriptionPlaceholder ||
		t("detail.selfMedia.initPanel.materialAttachment.descriptionPlaceholder", "添加说明…")

	const dropdownContent = enableProjectPicker ? (
		<DropdownMenuContent
			align="start"
			sideOffset={4}
			className={cn(
				"flex max-h-96 w-72 flex-col overflow-hidden p-0",
				selfMediaOverlayStyles.floatingPanel,
			)}
			onCloseAutoFocus={(e) => e.preventDefault()}
		>
			<ProjectFilePickerContent
				files={filteredProjectFiles}
				loading={loadingProjectFile}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				onSelect={handleProjectFileSelect}
				selectedPaths={selectedPaths}
				onLocalUpload={handleLocalUpload}
				multiSelect
				pendingIds={new Set(pendingProjectFiles.keys())}
				onToggle={handleProjectFileToggle}
				onConfirm={handleConfirmProjectFiles}
				pendingCount={pendingProjectFiles.size}
				confirmLabel={t("detail.selfMedia.initPanel.referenceFilePicker.confirmSelection", {
					count: pendingProjectFiles.size,
					defaultValue: "确认添加 ({{count}})",
				})}
			/>
		</DropdownMenuContent>
	) : null

	const listRef = useRef<HTMLDivElement>(null)
	const useVirtualList = materials.length >= MATERIAL_VIRTUAL_THRESHOLD
	const rowHeight = compact ? COMPACT_ROW_HEIGHT : FULL_ROW_HEIGHT

	const virtualizer = useVirtualizer({
		count: materials.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => rowHeight,
		overscan: 4,
		enabled: useVirtualList,
	})

	const renderMaterialRow = (item: MaterialItem) => (
		<MaterialAttachmentRow
			key={item.id}
			item={item}
			compact={compact}
			descriptionPlaceholder={resolvedDescriptionPlaceholder}
			onRemove={handleRemove}
			onDescriptionChange={handleDescriptionChange}
		/>
	)

	return (
		<div
			className={cn(
				"relative space-y-2 transition-colors",
				isDragging && "bg-primary/[0.03] ring-1 ring-primary/30",
				className,
			)}
			onPaste={handlePaste}
			tabIndex={-1}
			data-testid="handle-paste"
			{...dropZoneProps}
		>
			{isDragging ? (
				<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border border-dashed border-primary/40 bg-primary/5 text-[11px] font-semibold text-primary">
					{t("detail.selfMedia.initPanel.referenceFilePicker.dropHere", "拖放文件到这里")}
				</div>
			) : null}
			{compact ? (
				enableProjectPicker ? (
					<DropdownMenu open={showProjectPicker} onOpenChange={handleOpenChange}>
						<DropdownMenuTrigger asChild>
							<MaterialUploadTrigger compact label={uploadLabel} />
						</DropdownMenuTrigger>
						{dropdownContent}
					</DropdownMenu>
				) : (
					<MaterialUploadTrigger
						compact
						label={uploadLabel}
						onClick={() => inputRef.current?.click()}
					/>
				)
			) : enableProjectPicker ? (
				<DropdownMenu open={showProjectPicker} onOpenChange={handleOpenChange}>
					<DropdownMenuTrigger asChild>
						<MaterialUploadTrigger
							compact={false}
							label={uploadLabel}
							hint={emptyHint}
						/>
					</DropdownMenuTrigger>
					{dropdownContent}
				</DropdownMenu>
			) : (
				<MaterialUploadTrigger
					compact={false}
					label={uploadLabel}
					hint={emptyHint}
					onClick={() => inputRef.current?.click()}
				/>
			)}

			<input
				ref={inputRef}
				type="file"
				multiple
				accept={ACCEPT_TYPES}
				className="hidden"
				onChange={(e) => {
					handleFiles(e.target.files)
					e.target.value = ""
				}}
				data-testid="handle-files"
			/>

			{materials.length > 0 ? (
				useVirtualList ? (
					<div
						ref={listRef}
						className="max-h-80 overflow-y-auto"
						style={{ contentVisibility: "auto" as const }}
					>
						<div
							className="relative w-full"
							style={{ height: `${virtualizer.getTotalSize()}px` }}
						>
							{virtualizer.getVirtualItems().map((virtualItem) => {
								const item = materials[virtualItem.index]
								return (
									<div
										key={item.id}
										className="absolute left-0 top-0 w-full pb-2"
										style={{ transform: `translateY(${virtualItem.start}px)` }}
									>
										{renderMaterialRow(item)}
									</div>
								)
							})}
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-2">{materials.map(renderMaterialRow)}</div>
				)
			) : null}
		</div>
	)
}
