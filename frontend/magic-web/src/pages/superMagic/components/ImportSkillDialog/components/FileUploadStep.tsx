import { memo, useCallback, useMemo, useRef } from "react"
import { ChevronDown, Upload, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Button } from "@/components/shadcn-ui/button"
import { Progress } from "@/components/shadcn-ui/progress"
import type { UploadedFile } from "../types"

interface FileUploadStepProps {
	uploadedFile: UploadedFile | null
	onFileSelect: (file: File) => void
	onFolderSelect: (files: File[]) => void
	onDropDataTransfer: (dataTransfer: DataTransfer) => void
	onFileRemove: () => void
}

function FileUploadStep({
	uploadedFile,
	onFileSelect,
	onFolderSelect,
	onDropDataTransfer,
	onFileRemove,
}: FileUploadStepProps) {
	const { t } = useTranslation("crew/market")
	const inputRef = useRef<HTMLInputElement>(null)

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			onDropDataTransfer(e.dataTransfer)
		},
		[onDropDataTransfer],
	)

	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
	}, [])

	const handleBrowse = useCallback(() => {
		inputRef.current?.click()
	}, [])

	const handleBrowseFolder = useCallback(() => {
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = true
		input.webkitdirectory = true
		input.style.display = "none"
		input.dataset.testid = "skill-import-folder-input"

		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files
			if (files && files.length > 0) {
				onFolderSelect(Array.from(files))
			}
			document.body.removeChild(input)
		}

		document.body.appendChild(input)
		input.click()
	}, [onFolderSelect])

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file) onFileSelect(file)
			// Reset input to allow re-selecting the same file
			e.target.value = ""
		},
		[onFileSelect],
	)

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	const browseMenuItems = useMemo(
		() => [
			{
				key: "browse-file",
				label: t("importSkill.fileUpload.browseFiles"),
				onClick: handleBrowse,
				"data-testid": "skill-import-browse-file-option",
			},
			{
				key: "browse-folder",
				label: t("importSkill.fileUpload.browseFolder"),
				onClick: handleBrowseFolder,
				"data-testid": "skill-import-browse-folder-option",
			},
		],
		[t, handleBrowse, handleBrowseFolder],
	)

	return (
		<div className="flex w-full flex-col gap-2">
			<input
				ref={inputRef}
				type="file"
				className="hidden"
				onChange={handleInputChange}
				accept=".skill,.zip"
				data-testid="skill-import-file-input"
			/>

			{/* Drop zone */}
			<div
				className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-5 py-6 shadow-xs"
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				data-testid="skill-import-dropzone"
			>
				<div className="flex size-12 items-center justify-center rounded-md border border-border bg-card p-2 shadow-xs">
					<Upload className="size-6 text-foreground" />
				</div>
				<p className="text-center text-sm font-medium text-foreground">
					{t("importSkill.fileUpload.dragDrop")}
				</p>
				<p className="text-center text-xs text-muted-foreground">
					{t("importSkill.fileUpload.browseHint")}
				</p>
				<MagicDropdown
					menu={{ items: browseMenuItems }}
					trigger={["click"]}
					placement="bottom"
					overlayClassName="min-w-[180px]"
				>
					<span>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							data-testid="skill-import-browse-button"
						>
							{t("importSkill.fileUpload.browseEntry")}
							<ChevronDown className="size-4" />
						</Button>
					</span>
				</MagicDropdown>
			</div>

			{/* Uploaded file card */}
			{uploadedFile && (
				<div
					className="flex flex-col gap-2 rounded-md border border-input bg-background p-2 shadow-xs"
					data-testid="skill-import-file-card"
				>
					<div className="flex items-center gap-2">
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<p className="truncate text-sm font-medium text-foreground">
								{uploadedFile.file.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{formatFileSize(uploadedFile.file.size)}
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
							onClick={onFileRemove}
							data-testid="skill-import-file-remove"
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
					<Progress
						value={uploadedFile.progress}
						className="h-2"
						data-testid="skill-import-progress"
					/>
				</div>
			)}
		</div>
	)
}

export default memo(FileUploadStep)
