import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { PanelLeftOpen } from "lucide-react"
import { MagicTooltip } from "@/components/base"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import type { RecordingDetailFileMap, RecordingDetailFileRef } from "../../types/recording-detail"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { RecordingDetailEmptyState } from "./RecordingDetailEmptyState"
import { RecordingDetailRegionEmptySlot } from "./RecordingDetailRegionEmptySlot"
import { RecordingDetailSummaryState } from "./RecordingDetailSummaryState"
import { RecordingDetailTabStrip } from "./RecordingDetailTabStrip"
import { RECORDING_DESKTOP_MD_CONTENT_CLASS } from "./recording-detail-layout"
import { RecordingMarkdownContent } from "./RecordingMarkdownContent"
import { RecordingSummaryContent } from "./RecordingSummaryContent"
import { resolveSummaryTypeLabel } from "./resolve-summary-type-label"
import { hasConfiguredRecordingFile } from "../../utils/recording-detail-files"

interface RecordingDetailRightPanelProps {
	fileMap: RecordingDetailFileMap | null
	summaryContent: Record<string, string | undefined>
	notesContent?: string
	attachmentTree?: AttachmentFile[]
	notesFilePath?: string
	attachmentList: AttachmentItem[]
	summaryReady: boolean
	summarizing: boolean
	summaryFailed: boolean
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
	onGenerateSummary?: () => void
	summarySubmitting?: boolean
	/** Controls whether the notes source tab is available in readonly share views. */
	showNotesTab?: boolean
	/** Optionally controls the selected content tab for project-preview integrations. */
	activeKey?: string
	/** Reports the resolved content tab so external toolbars can follow its file context. */
	onActiveKeyChange?: (activeKey: string) => void
	/** When the transcript column is collapsed, shows an expand action in the tab strip. */
	transcriptCollapsed?: boolean
	onExpandTranscript?: () => void
}

/** Builds the dynamic right-panel tabs and renders summary/notes content or state placeholders. */
export const RecordingDetailRightPanel = memo(function RecordingDetailRightPanel({
	fileMap,
	summaryContent,
	notesContent,
	attachmentTree = [],
	notesFilePath,
	attachmentList,
	summaryReady,
	summarizing,
	summaryFailed,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
	onGenerateSummary,
	summarySubmitting = false,
	showNotesTab = true,
	activeKey: controlledActiveKey,
	onActiveKeyChange,
	transcriptCollapsed = false,
	onExpandTranscript,
}: RecordingDetailRightPanelProps) {
	const { t } = useTranslation("audioRecordings")
	const tabs = useMemo(
		() => buildRightPanelTabs(fileMap, summaryContent, t, showNotesTab),
		[fileMap, showNotesTab, summaryContent, t],
	)
	const [internalActiveKey, setInternalActiveKey] = useState<string>(tabs[0]?.key ?? "notes")
	const prevSummaryReadyRef = useRef(summaryReady)
	const activeKey = controlledActiveKey ?? internalActiveKey

	/** Keeps standalone pages uncontrolled while allowing project previews to own tab context. */
	const handleActiveKeyChange = useCallback(
		(nextActiveKey: string) => {
			if (controlledActiveKey === undefined) setInternalActiveKey(nextActiveKey)
			onActiveKeyChange?.(nextActiveKey)
		},
		[controlledActiveKey, onActiveKeyChange],
	)

	// Reset to the first summary tab when summary content becomes ready after a pending/generating state.
	useEffect(() => {
		if (!prevSummaryReadyRef.current && summaryReady) {
			handleActiveKeyChange(tabs[0]?.key ?? "notes")
		}
		prevSummaryReadyRef.current = summaryReady
	}, [handleActiveKeyChange, summaryReady, tabs])

	const resolvedActiveKey = tabs.some((tab) => tab.key === activeKey)
		? activeKey
		: (tabs[0]?.key ?? "notes")

	// Notify controlled consumers when loading or file-map changes invalidate the requested tab.
	useEffect(() => {
		if (resolvedActiveKey !== controlledActiveKey && controlledActiveKey !== undefined) {
			onActiveKeyChange?.(resolvedActiveKey)
		}
	}, [controlledActiveKey, onActiveKeyChange, resolvedActiveKey])

	if (!summaryReady) {
		const status = summarizing ? "generating" : summaryFailed ? "failed" : "pending"
		return (
			<div
				className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-sm"
				data-testid="recording-detail-right-panel"
			>
				<RecordingDetailSummaryState
					status={status}
					onGenerateSummary={onGenerateSummary}
					generating={summarySubmitting}
				/>
			</div>
		)
	}

	if (tabs.length === 0) {
		return (
			<div
				className="flex h-full min-h-0 items-center justify-center rounded-[22px] border border-border bg-card shadow-sm"
				data-testid="recording-detail-right-panel"
			>
				<RecordingDetailEmptyState variant="noSummary" />
			</div>
		)
	}

	const activeTab = tabs.find((tab) => tab.key === resolvedActiveKey) ?? tabs[0]

	return (
		<div
			// The panel must shrink with the workbench so focused transcript rows cannot scroll the horizontal viewport vertically.
			className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-sm"
			data-testid="recording-detail-right-panel"
		>
			<RecordingDetailTabStrip
				tabs={tabs}
				activeKey={resolvedActiveKey}
				onChange={handleActiveKeyChange}
				leading={
					transcriptCollapsed ? (
						<MagicTooltip
							title={t("detail.expandTranscriptPanelAria")}
							placement="bottom"
						>
							<button
								type="button"
								aria-label={t("detail.expandTranscriptPanelAria")}
								onClick={onExpandTranscript}
								className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent shadow-sm transition-colors duration-200 hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								data-testid="recording-detail-expand-transcript"
							>
								<PanelLeftOpen size={16} className="shrink-0 text-foreground" />
							</button>
						</MagicTooltip>
					) : undefined
				}
			/>

			{activeTab?.kind === "metrics" || activeTab?.file.type === "mindmap" ? (
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
					<RecordingSummaryContent
						file={activeTab.file}
						content={activeTab.content}
						attachmentList={attachmentList}
						attachmentTree={attachmentTree}
						speakerNameMap={speakerNameMap}
						onOpenSpeakerSettings={onOpenSpeakerSettings}
						onTimeClick={onTimeClick}
						isGenerating={summarizing}
						layout="desktop"
					/>
				</div>
			) : (
				<ScrollEdgeFadeContainer
					fadeColor="card"
					className="min-h-0 flex-1"
					scrollClassName="py-4 [scrollbar-width:thin]"
					contentDeps={[
						resolvedActiveKey,
						activeTab?.kind,
						activeTab?.content,
						notesContent,
						tabs.length,
					]}
				>
					{activeTab?.kind === "notes" ? (
						notesContent?.trim() ? (
							<div className={RECORDING_DESKTOP_MD_CONTENT_CLASS}>
								<RecordingMarkdownContent
									content={notesContent}
									layout="desktop"
									attachments={attachmentTree}
									relativeFilePath={notesFilePath}
									speakerNameMap={speakerNameMap}
									onSpeakerClick={onOpenSpeakerSettings}
									onTimeClick={(time) => onTimeClick(time)}
								/>
							</div>
						) : (
							<RecordingDetailRegionEmptySlot>
								<RecordingDetailEmptyState
									variant={summarizing ? "summaryGenerating" : "noNotes"}
									compact
								/>
							</RecordingDetailRegionEmptySlot>
						)
					) : activeTab ? (
						<RecordingSummaryContent
							file={activeTab.file}
							content={activeTab.content}
							attachmentList={attachmentList}
							attachmentTree={attachmentTree}
							speakerNameMap={speakerNameMap}
							onOpenSpeakerSettings={onOpenSpeakerSettings}
							onTimeClick={onTimeClick}
							isGenerating={summarizing}
							layout="desktop"
						/>
					) : null}
				</ScrollEdgeFadeContainer>
			)}
		</div>
	)
})

interface RightPanelTab {
	key: string
	label: string
	kind: "summary" | "notes" | "metrics"
	file: RecordingDetailFileRef
	content?: string
	badgeCount?: number
}

/** Assembles summary tabs and appends notes when config and access gates allow it. */
function buildRightPanelTabs(
	fileMap: RecordingDetailFileMap | null,
	summaryContent: Record<string, string | undefined>,
	t: ReturnType<typeof useTranslation>["t"],
	showNotesTab = true,
): RightPanelTab[] {
	const summaryTabs =
		fileMap?.summaryFiles.map((file) => ({
			key: file.type,
			label: resolveSummaryTypeLabel(file.type),
			kind: file.type === "metrics" ? ("metrics" as const) : ("summary" as const),
			file,
			content: summaryContent[file.type],
		})) ?? []

	// Notes follows the same config-driven visibility rule as generated summary tabs.
	if (!showNotesTab || !hasConfiguredRecordingFile(fileMap, "notes")) return summaryTabs

	const notesTab: RightPanelTab = {
		key: "notes",
		label: t("detail.tabs.notes"),
		kind: "notes",
		file: {
			type: "notes",
			fileName: "notes",
			file: fileMap?.notes ?? ({} as AttachmentItem),
		},
		content: undefined,
	}

	// Keep summary as the landing tab and slot notes right after it, matching the legacy HTML order
	// where notes led the analysis panels. Without a summary tab, notes becomes the only entry.
	const [leadingSummary, ...remainingSummaryTabs] = summaryTabs
	return leadingSummary ? [leadingSummary, notesTab, ...remainingSummaryTabs] : [notesTab]
}
