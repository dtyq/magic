import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import React, { useState, useEffect } from "react"
import {
	ChevronRight,
	ChevronLeft,
	Music,
	FileText,
	Link2,
	NotebookPen,
	Sparkles,
	Search as SearchIcon,
	X,
	Check,
	Copy,
	LogIn,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/utils/cn"
import { downloadRecordingAttachmentFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-attachment"
import { downloadRecordingFilesBatch } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-batch"
import { getAttachmentFileName } from "../utils/recording-detail-files"
import type { RecordingDetailFileMap } from "../types"

interface MobileRecordingShareExportSheetProps {
	open: boolean
	recordingName: string
	fileMap: RecordingDetailFileMap | null
	projectId?: string
	allowDownload?: boolean
	showShareSection?: boolean
	showCopyProject?: boolean
	copyProjectLabel?: string
	showLogin?: boolean
	loginLabel?: string
	mainHeaderTitle?: string
	onOpenChange: (open: boolean) => void
	onShareLink: () => void
	onDownloadRecording: () => void
	onSearch?: () => void
	onCopyProject?: () => void
	onLogin?: () => void
}

interface ActionRowProps {
	label: string
	icon: React.ReactNode
	onClick?: () => void
	disabled?: boolean
	showDivider?: boolean
	testId?: string
}

/** Individual list items inside the action sheet menu groups. */
function ActionRow({
	label,
	icon,
	onClick,
	disabled = false,
	showDivider = false,
	testId = "mobile-recording-share-action",
}: ActionRowProps) {
	// Normalize icon size and color to match prototype standard (17px, strokeWidth 1.8)
	const normalizedIcon = React.isValidElement(icon)
		? React.cloneElement(icon, {
				className: cn(icon.props.className, "h-[17px] w-[17px] text-primary"),
				strokeWidth: 1.8,
			})
		: icon

	return (
		<>
			<button
				type="button"
				disabled={disabled}
				onClick={onClick}
				className="flex h-12 w-full items-center gap-3 bg-card px-[14px] text-left transition-opacity active:opacity-60 disabled:opacity-40"
				data-testid={testId}
			>
				<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					{normalizedIcon}
				</span>
				<span className="min-w-0 flex-1 text-[16px] leading-5 text-foreground">
					{label}
				</span>
				<ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
			</button>
			{showDivider && (
				<div className="h-px w-full bg-card pl-[58px]">
					<div className="h-px bg-border/40" />
				</div>
			)}
		</>
	)
}

/** Checkbox action rows for multi-file summary selection. */
interface CheckRowProps {
	label: string
	checked: boolean
	onToggle: () => void
	showDivider?: boolean
}

function CheckRow({ label, checked, onToggle, showDivider = false }: CheckRowProps) {
	return (
		<>
			<button
				type="button"
				onClick={onToggle}
				className="flex h-12 w-full items-center gap-3 bg-card px-[14px] text-left transition-opacity active:opacity-60"
			>
				{checked ? (
					<div className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
						<Check className="size-3.5 text-primary-foreground" strokeWidth={2.5} />
					</div>
				) : (
					<div className="size-[22px] shrink-0 rounded-full border-2 border-muted-foreground/35" />
				)}
				<span className="min-w-0 flex-1 text-[15px] leading-5 text-foreground">
					{label}
				</span>
			</button>
			{showDivider && (
				<div className="h-px w-full bg-card pl-[48px]">
					<div className="h-px bg-border/40" />
				</div>
			)}
		</>
	)
}

/**
 * Prototype-aligned "Share & Export" sheet for H5 recording details.
 * Contains direct downloading for audio, transcript, and notes.
 * Provides a second-level selection menu for exporting multiple summary files.
 */
export function MobileRecordingShareExportSheet({
	open,
	recordingName,
	fileMap,
	projectId,
	allowDownload = true,
	showShareSection = true,
	showCopyProject = false,
	copyProjectLabel,
	showLogin = false,
	loginLabel,
	mainHeaderTitle,
	onOpenChange,
	onShareLink,
	onDownloadRecording,
	onSearch,
	onCopyProject,
	onLogin,
}: MobileRecordingShareExportSheetProps) {
	const { permissions: access } = useFileAccess()
	const effectiveAllowDownload = access.download && allowDownload
	const { t } = useTranslation(["audioRecordings", "super"])
	const [view, setView] = useState<"main" | "exportSummary">("main")
	const [selectedSummaryTypes, setSelectedSummaryTypes] = useState<Set<string>>(new Set())

	// Reset sheet view and default-selected summary items when opening.
	useEffect(() => {
		if (open) {
			setView("main")
			const availableTypes = fileMap?.summaryFiles?.map((f) => f.type) || []
			setSelectedSummaryTypes(new Set(availableTypes))
		}
	}, [open, fileMap])

	/** Instantly downloads the original transcript Markdown file. */
	async function handleDownloadTranscript() {
		if (!effectiveAllowDownload) return
		if (!fileMap?.transcript?.file_id) return
		const fileName =
			getAttachmentFileName(fileMap.transcript) || `${recordingName}_transcript.md`
		const ok = await downloadRecordingAttachmentFile({
			fileId: fileMap.transcript.file_id,
			fileName,
		})
		if (!ok) toast.error(t("detail.loadFailed"))
	}

	/** Instantly downloads the original notes Markdown file. */
	async function handleDownloadNotes() {
		if (!effectiveAllowDownload) return
		if (!fileMap?.notes?.file_id) return
		const fileName = getAttachmentFileName(fileMap.notes) || `${recordingName}_notes.md`
		const ok = await downloadRecordingAttachmentFile({
			fileId: fileMap.notes.file_id,
			fileName,
		})
		if (!ok) toast.error(t("detail.loadFailed"))
	}

	/** Downloads all checked summary files (single download directly, multi-select triggers backend batch download). */
	async function handleDownloadSummary() {
		if (!effectiveAllowDownload) return
		if (selectedSummaryTypes.size === 0) {
			toast.info(t("detail.noExportFilesSelected"))
			return
		}

		const filesToDownload: { fileId: string; fileName: string }[] = []
		for (const type of selectedSummaryTypes) {
			const fileRef = fileMap?.summaryFiles.find((f) => f.type === type)
			if (fileRef?.file?.file_id) {
				const fileName = getAttachmentFileName(fileRef.file)
				filesToDownload.push({ fileId: fileRef.file.file_id, fileName })
			}
		}

		if (filesToDownload.length === 0) return

		const fileNameById = Object.fromEntries(
			filesToDownload.map((file) => [file.fileId, file.fileName]),
		)
		const ok = await downloadRecordingFilesBatch({
			fileIds: filesToDownload.map((file) => file.fileId),
			projectId,
			fileNameById,
		})
		if (!ok && filesToDownload.length === 1) {
			toast.error(t("detail.loadFailed"))
		}
	}

	/** Localizes summary component file type tokens. */
	function getSummaryTabLabel(type: string) {
		const keyMap: Record<string, string> = {
			summary: "tabs.summary",
			topics: "tabs.topics",
			highlights: "tabs.highlights",
			insights: "tabs.insights",
			mindmap: "tabs.mindmap",
			followup: "tabs.followup",
			power_dynamics: "tabs.powerDynamics",
			intent: "tabs.intent",
		}
		const key = keyMap[type] || `tabs.${type}`
		return t(`detail.${key}`)
	}

	/** Toggles individual checkbox item inside the selection set. */
	function toggleSummaryType(type: string) {
		setSelectedSummaryTypes((prev) => {
			const next = new Set(prev)
			if (next.has(type)) {
				next.delete(type)
			} else {
				next.add(type)
			}
			return next
		})
	}

	const hasSummaryFiles = Boolean(fileMap?.summaryFiles && fileMap.summaryFiles.length > 0)
	const resolvedMainHeaderTitle = mainHeaderTitle ?? t("detail.shareAndExport")

	return (
		<MagicPopup
			visible={open}
			onOpenChange={onOpenChange}
			onClose={() => onOpenChange(false)}
			position="bottom"
			headerVariant="actionHeader"
			headerTitle={view === "main" ? resolvedMainHeaderTitle : t("detail.exportSummary")}
			headerLeadingAction={
				view === "main"
					? {
							icon: <X />,
							ariaLabel: t("actions.cancel"),
							onClick: () => onOpenChange(false),
							testId: "mobile-recording-share-export-close",
						}
					: {
							icon: <ChevronLeft />,
							ariaLabel: t("detail.back"),
							onClick: () => setView("main"),
							testId: "mobile-recording-share-export-back",
						}
			}
			className="flex flex-col overflow-hidden rounded-t-[28px] border-0 bg-[#f7f7f8] p-0"
			bodyClassName="no-scrollbar flex flex-col gap-[10px] overflow-y-auto px-[14px] pb-6 pt-1"
			style={{ boxShadow: "0 -14px 44px rgba(0,0,0,0.18)" }}
			data-testid="mobile-recording-share-export-sheet"
		>
			{view === "main" ? (
				<>
					{onSearch ? (
						<div className="flex flex-col gap-2">
							<div className="overflow-hidden rounded-[22px] bg-card">
								<ActionRow
									label={t("detail.searchContent")}
									testId="mobile-recording-share-search-action"
									icon={<SearchIcon />}
									onClick={() => {
										onSearch()
										onOpenChange(false)
									}}
								/>
							</div>
						</div>
					) : null}
					{showCopyProject || showLogin ? (
						<div className="flex flex-col gap-2">
							<div className="overflow-hidden rounded-[22px] bg-card">
								{showCopyProject ? (
									<ActionRow
										label={
											copyProjectLabel ??
											t("audioRecordings:card.copyToProject")
										}
										testId="mobile-recording-share-copy-project-action"
										icon={<Copy />}
										onClick={() => {
											onOpenChange(false)
											onCopyProject?.()
										}}
										showDivider={showLogin}
									/>
								) : null}
								{showLogin ? (
									<ActionRow
										label={loginLabel ?? t("super:share.login")}
										testId="mobile-recording-share-login-action"
										icon={<LogIn />}
										onClick={() => {
											onOpenChange(false)
											onLogin?.()
										}}
									/>
								) : null}
							</div>
						</div>
					) : null}
					{showShareSection && access.share ? (
						<div className="flex flex-col gap-2">
							<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
								{t("detail.shareSection")}
							</p>
							<div className="overflow-hidden rounded-[22px] bg-card">
								<ActionRow
									label={t("detail.shareLink")}
									testId="mobile-recording-share-share-link-action"
									icon={<Link2 />}
									onClick={() => {
										if (access.share) onShareLink()
									}}
								/>
							</div>
						</div>
					) : null}

					{effectiveAllowDownload ? (
						<div className="flex flex-col gap-2">
							<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
								{t("detail.exportSection")}
							</p>
							<div className="overflow-hidden rounded-[22px] bg-card">
								<ActionRow
									label={t("detail.exportRecording")}
									testId="mobile-recording-share-export-recording-action"
									icon={<Music />}
									onClick={() => {
										if (effectiveAllowDownload) onDownloadRecording()
									}}
									disabled={!fileMap?.audio}
									showDivider
								/>
								<ActionRow
									label={t("detail.exportTranscript")}
									testId="mobile-recording-share-export-transcript-action"
									icon={<FileText />}
									onClick={handleDownloadTranscript}
									disabled={!fileMap?.transcript}
									showDivider
								/>
								<ActionRow
									label={t("detail.exportNotes")}
									testId="mobile-recording-share-export-notes-action"
									icon={<NotebookPen />}
									onClick={handleDownloadNotes}
									disabled={!fileMap?.notes}
									showDivider
								/>
								<ActionRow
									label={t("detail.exportSummary")}
									testId="mobile-recording-share-export-summary-action"
									icon={<Sparkles />}
									onClick={() => setView("exportSummary")}
									disabled={!hasSummaryFiles}
								/>
							</div>
						</div>
					) : null}
				</>
			) : (
				<>
					<div className="flex flex-col gap-2">
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("detail.exportContentLabel")}
						</p>
						<div className="overflow-hidden rounded-[22px] bg-card">
							{fileMap?.summaryFiles?.map((fileRef, i) => (
								<CheckRow
									key={fileRef.type}
									label={getSummaryTabLabel(fileRef.type)}
									data-testid={`mobile-recording-share-export-summary-${fileRef.type}-action`}
									checked={selectedSummaryTypes.has(fileRef.type)}
									onToggle={() => toggleSummaryType(fileRef.type)}
									showDivider={i < fileMap.summaryFiles.length - 1}
								/>
							))}
						</div>
					</div>

					<div className="mt-1 shrink-0">
						<button
							type="button"
							onClick={handleDownloadSummary}
							disabled={!effectiveAllowDownload || selectedSummaryTypes.size === 0}
							className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[16px] font-medium text-primary-foreground transition-opacity active:opacity-80 disabled:opacity-40"
							data-testid="mobile-recording-share-export-summary-button"
						>
							{t("detail.exportSummary")}
						</button>
					</div>
				</>
			)}
		</MagicPopup>
	)
}
