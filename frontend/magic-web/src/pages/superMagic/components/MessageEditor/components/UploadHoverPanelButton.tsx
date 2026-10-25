import { IconFileUpload, IconX } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { Upload } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/shadcn-ui/hover-card"
import { Badge } from "@/components/shadcn-ui/badge"
import MagicIcon from "@/components/base/MagicIcon"
import UploadAction from "@/components/base/UploadAction"
import { cn } from "@/utils/cn"
import type { FileData, MessageEditorSize } from "../types"
import type { FileUploadStore } from "../stores/FileUploadStore"
import { MagicTooltip } from "@/components/base"
import { toDisplayUploadProgress } from "../utils/uploadProgress"

interface UploadHoverPanelButtonProps {
	iconSize: number
	size: MessageEditorSize
	onFileChange: (files: FileList) => void
	onRemoveFile: (file: FileData) => void
	fileUploadStore: FileUploadStore
	t: (key: string, options?: Record<string, unknown>) => string
	className?: string
}

function UploadHoverPanelButtonComponent({
	iconSize,
	size,
	onFileChange,
	onRemoveFile,
	fileUploadStore,
	t,
	className,
}: UploadHoverPanelButtonProps) {
	const uploadLabel = t("topicFiles.emptyState.uploadFile", { ns: "super" })
	// UploadAction invokes its render prop outside this observer's render reaction.
	// Read observable fields here so in-place progress updates rerender the hover panel.
	const fileItems = fileUploadStore.files.map((file) => ({
		file,
		id: file.id,
		name: file.name,
		status: file.status,
		progress: toDisplayUploadProgress(file.progress) ?? 0,
	}))
	const fileCount = fileItems.length

	const getFileIcon = () => {
		// TODO: Return different icons based on file type
		return <MagicIcon component={IconFileUpload} size={24} />
	}

	return (
		<UploadAction
			multiple
			onFileChange={onFileChange}
			handler={(trigger) => (
				<HoverCard openDelay={120} closeDelay={120}>
					<HoverCardTrigger asChild>
						<span>
							<MagicTooltip title={uploadLabel}>
								<button
									type="button"
									data-guide-action="upload-file"
									aria-label={uploadLabel}
									className={cn(
										"flex items-center justify-center gap-1 rounded-md border-0 bg-secondary text-foreground transition-all hover:opacity-80 active:opacity-60",
										"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
										size === "small" ? "h-6 px-1" : "h-8 px-2",
										className,
									)}
									style={{
										boxShadow: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
									}}
									onClick={trigger}
									data-testid="super-message-editor-upload-button"
									data-count={fileCount}
									data-active={fileCount > 0}
								>
									<Upload size={iconSize} className="shrink-0" />
									{fileCount > 0 && (
										<Badge
											variant="outline"
											className="h-5 overflow-visible rounded-md bg-white px-2 py-0.5 text-xs font-semibold"
										>
											{fileCount}
										</Badge>
									)}
								</button>
							</MagicTooltip>
						</span>
					</HoverCardTrigger>
					{fileCount > 0 && (
						<HoverCardContent
							side="top"
							align="start"
							sideOffset={8}
							className="z-[1200] w-[320px] rounded-lg border border-border bg-popover p-2.5 shadow-md"
						>
							{/* Header */}
							<div className="mb-2.5 w-full">
								<p className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground">
									{t("fileUpload.uploadedAttachments", {
										count: fileCount,
										defaultValue: `已上传附件 (${fileCount})`,
									})}
								</p>
							</div>

							{/* Attachment List */}
							<div className="flex w-full flex-col gap-1">
								{fileItems.map(({ file, id, name, status, progress }) => {
									const isUploading = status === "uploading"

									return (
										<div
											key={id}
											className="relative flex w-full items-center gap-2 overflow-clip rounded-sm px-2.5 py-1.5 hover:bg-accent"
										>
											{/* Progress background for uploading files */}
											{isUploading && (
												<div
													className="absolute left-0 top-0 h-full bg-primary/10"
													style={{ width: `${progress}%` }}
												/>
											)}

											{/* File Icon */}
											<div className="relative z-10 size-6 shrink-0 overflow-clip">
												{getFileIcon()}
											</div>

											{/* File Name */}
											<p className="relative z-10 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-foreground">
												{name}
											</p>

											{/* Upload Progress */}
											{isUploading && (
												<p className="relative z-10 shrink-0 text-xs leading-4 text-foreground">
													{progress}%
												</p>
											)}

											{/* Remove Button */}
											<button
												type="button"
												className="relative z-10 flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-transparent py-2 pl-2 transition-all"
												onClick={(e) => {
													e.stopPropagation()
													onRemoveFile(file)
												}}
												aria-label="Remove file"
												data-testid="on-remove-file"
											>
												<MagicIcon component={IconX} size={24} />
											</button>
										</div>
									)
								})}
							</div>
						</HoverCardContent>
					)}
				</HoverCard>
			)}
		/>
	)
}

export default observer(UploadHoverPanelButtonComponent)
