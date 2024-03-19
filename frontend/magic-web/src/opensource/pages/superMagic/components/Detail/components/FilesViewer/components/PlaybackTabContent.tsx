import { memo, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { isEmpty } from "lodash-es"
import { Flex, Tooltip } from "antd"
import { IconExternalLink } from "@tabler/icons-react"
import { cn } from "@/opensource/lib/utils"
import Render from "../../../Render"
import PlaybackControl from "../../../components/PlaybackControl"
import StatusIcon from "../../../../MessageHeader/components/StatusIcon"
import ToolIcon from "../../../../MessageList/components/Tool/components/ToolIcon"
import { ActionButton } from "../../CommonHeader/components"
import useToolSteps from "../../../hooks/useToolSteps"
import useDetailState from "../../../hooks/useDetailState"
import useToolStepState from "../../../hooks/useToolStepState"
import useShareRoute from "@/opensource/pages/superMagic/hooks/useShareRoute"
import type {
	TaskStatus,
	Topic,
	ProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import BreathingLight from "../resource/breathingLight"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { correctDetailType } from "../utils/preview"
import { ToolIconBadge } from "../../../../MessageList/components/shared/ToolIconConfig"

export interface PlaybackTabContentProps {
	disPlayDetail: unknown
	setUserSelectDetail?: (detail: unknown) => void
	userSelectDetail?: unknown
	attachments?: unknown[]
	attachmentList?: any[]
	topicId?: string
	baseShareUrl?: string
	currentTopicStatus?: TaskStatus
	messages?: unknown[]
	autoDetail?: unknown
	showPlaybackControl?: boolean
	allowEdit?: boolean
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	isFileShare?: boolean
	activeFileId?: string | null
	onActiveFileChange?: (fileId: string | null) => void
	openFileTab?: (fileId: string, path: string) => void
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	getFileViewMode?: (fileId: string) => "code" | "desktop" | "phone"
	handleViewModeChange?: (fileId: string, mode: "code" | "desktop" | "phone") => void
	onDownload?: (fileId?: string) => void
	isFullscreen?: boolean
	onFullscreenChange?: (isFullscreen: boolean) => void
}

function PlaybackTabContent(props: PlaybackTabContentProps) {
	const {
		disPlayDetail,
		setUserSelectDetail,
		userSelectDetail,
		attachments,
		attachmentList,
		topicId,
		baseShareUrl,
		currentTopicStatus,
		messages = [],
		autoDetail,
		showPlaybackControl = true,
		allowEdit,
		selectedTopic,
		selectedProject,
		isFileShare,
		activeFileId,
		onActiveFileChange,
		openFileTab,
		getFileViewMode,
		handleViewModeChange,
		onDownload,
		isFullscreen = false,
		onFullscreenChange,
	} = props

	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()

	// 用于引用父元素（保留 ref 用于其他可能的用途）
	const renderContainerRef = useRef<HTMLDivElement>(null)

	// 使用 useToolSteps hook 处理工具步骤逻辑
	const {
		toolSteps,
		currentProgress,
		currentStepIndex,
		handleProgressChange,
		handlePrevStep,
		handleNextStep,
	} = useToolSteps({
		selectedTopic,
		setUserSelectDetail,
		displayDetail: disPlayDetail,
		userSelectDetail,
		autoDetail,
		isFullscreen,
		setIsFullscreen: onFullscreenChange,
	})

	// 使用新的 useDetailState hook 管理状态
	const { showAnimation, shouldShowBackToLatestButton } = useDetailState({
		currentTopicStatus,
		userSelectDetail,
		autoDetail,
		selectedTopic,
		messages,
		toolSteps,
		currentStepIndex,
		isFromNode: false,
		isShareRoute,
		isFileShare,
		disPlayDetail,
		isPlaybackMode: true, // 标识当前在演示模式（playback tab）中
	})

	// 使用工具步骤状态hook
	const { currentToolStep } = useToolStepState({
		toolSteps,
		currentStepIndex,
	})

	// 修正 disPlayDetail 的类型：如果 metadata.type 是 design 但 type 是 notSupport，需要修正
	// 这个修正逻辑在源头（工具调用生成 detail 时）无法处理，因为 detail 可能来自后端
	const correctedDisPlayDetail = useMemo(() => {
		return correctDetailType(disPlayDetail)
	}, [disPlayDetail])

	// 获取当前文件的视图模式
	const { mode: currentFileViewMode, id: detailId } = useMemo(() => {
		const detail: any = correctedDisPlayDetail
		return {
			mode: getFileViewMode?.(detail?.id || detail?.data?.file_id) || "desktop",
			id: detail?.id || detail?.data?.file_id,
		}
	}, [correctedDisPlayDetail, getFileViewMode])

	const meta = useMemo(() => {
		const detail: any = correctedDisPlayDetail
		const list: any[] = attachmentList || []
		return list.find((o) => o?.file_id === detail?.data?.file_id)
	}, [attachmentList, correctedDisPlayDetail])

	const handleBackToLatest = () => {
		setUserSelectDetail?.(null)
	}

	// 处理打开原文件
	const handleOpenSourceFile = () => {
		const detail: any = correctedDisPlayDetail
		const sourceFileId = detail?.data?.source_file_id
		const fileExist = attachmentList?.find((o) => o?.file_id === sourceFileId)
		if (!fileExist) {
			magicToast.error(t("playbackControl.sourceFileMissing"))
			return
		}
		if (sourceFileId && openFileTab) {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: sourceFileId })
			pubsub.publish(PubSubEvents.Locate_File_In_Tree, sourceFileId)
		}
	}

	// 判断是否显示打开原文件按钮
	const shouldShowOpenSourceFileButton = useMemo(() => {
		const detail: any = correctedDisPlayDetail
		return !!detail?.data?.source_file_id
	}, [correctedDisPlayDetail])

	return (
		<div className="flex h-full flex-col overflow-hidden p-[14px]">
			{/* 虚拟机头部 */}
			{!isFileShare && (
				<Flex justify="space-between" className="mb-[14px] flex h-6 items-center gap-1">
					<Flex align="center" gap={4}>
						<StatusIcon status={currentTopicStatus} className="shrink-0" />
						<span className="shrink-0 text-[18px] font-medium leading-6 text-foreground">
							{t("playbackControl.magicVirtualMachine")}
						</span>

						{/* 工具卡片 */}
						{currentToolStep &&
							!isFileShare &&
							currentToolStep?.name &&
							currentToolStep?.action && (
								<div className="ml-1.5 mr-4 flex h-6 w-fit min-w-0 shrink items-center gap-1 overflow-hidden whitespace-nowrap rounded px-1 shadow-[0px_4px_14px_0px_rgba(255,119,0,0.1),0px_0px_1px_0px_rgba(0,0,0,0.3)] dark:shadow-[0px_4px_14px_0px_rgba(255,119,0,0.2),0px_0px_1px_0px_rgba(255,255,255,0.1)]">
									<ToolIconBadge
										toolName={currentToolStep?.name}
										size={16}
										iconSize={10}
									/>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												"max-w-[300px] shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-[18px] text-foreground",
												currentTopicStatus === "running" &&
													"animate-skeleton bg-[linear-gradient(90deg,#eef3fd_0%,#315cec_17.79%,#d3dffb_50%,#315cec_82.21%,#eef3fd_100%)] bg-[length:200%_100%] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,rgba(59,130,246,0.2)_0%,rgba(96,165,250,0.8)_17.79%,rgba(59,130,246,0.4)_50%,rgba(96,165,250,0.8)_82.21%,rgba(59,130,246,0.2)_100%)]",
											)}
										>
											{currentToolStep.action}
										</span>
									</div>
									{currentToolStep.remark && (
										<Tooltip title={currentToolStep.remark}>
											<span className="shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
												{currentToolStep.remark}
											</span>
										</Tooltip>
									)}
								</div>
							)}
					</Flex>
					{shouldShowOpenSourceFileButton && (
						<Flex align="center" gap={4}>
							{/* 打开原文件按钮 */}
							<ActionButton
								icon={IconExternalLink}
								text={t("playbackControl.openSourceFile")}
								onClick={handleOpenSourceFile}
								size={18}
								stroke={1.5}
								showText={true}
								title={t("playbackControl.openSourceFile")}
							/>
						</Flex>
					)}
				</Flex>
			)}

			<div
				ref={renderContainerRef}
				className={cn(
					"relative h-full overflow-hidden rounded-t-lg border border-border",
					isShareRoute && "rounded-lg",
					isFileShare && "border-none",
				)}
			>
				<Render
					type={(correctedDisPlayDetail as any)?.type}
					data={(correctedDisPlayDetail as any)?.data}
					attachments={attachments}
					setUserSelectDetail={setUserSelectDetail}
					currentIndex={0}
					onPrevious={() => {
						// No previous in playback mode
					}}
					onNext={() => {
						// No next in playback mode
					}}
					onFullscreen={() => onFullscreenChange?.(!isFullscreen)}
					onDownload={onDownload}
					totalFiles={0}
					hasUserSelectDetail={!isEmpty(userSelectDetail)}
					isFromNode={false}
					disPlayDetail={correctedDisPlayDetail}
					userSelectDetail={userSelectDetail}
					isFullscreen={isFullscreen}
					attachmentList={attachmentList}
					viewMode={currentFileViewMode}
					metadata={meta?.metadata}
					onViewModeChange={(mode: "code" | "desktop" | "phone") => {
						if (detailId && handleViewModeChange) handleViewModeChange(detailId, mode)
					}}
					topicId={topicId}
					baseShareUrl={baseShareUrl}
					currentFile={{
						id: (correctedDisPlayDetail as any)?.currentFile?.id || "",
						name: (correctedDisPlayDetail as any)?.data?.file_name || "",
						type: (correctedDisPlayDetail as any)?.data?.file_extension || "",
						url: (correctedDisPlayDetail as any)?.data?.file_url || "",
						source: (correctedDisPlayDetail as any)?.data?.source,
					}}
					allowEdit={allowEdit}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					className=""
					openFileTab={openFileTab}
					onRefreshFile={() => {
						// No refresh in playback mode
					}}
					activeFileId={activeFileId}
					showFooter={false}
					isPlaybackMode={true}
				/>

				{showAnimation && (
					<div className="pointer-events-none absolute inset-0 z-0 animate-pulse">
						<BreathingLight />
					</div>
				)}
			</div>

			{/* 进度条 */}
			{showPlaybackControl && toolSteps.length > 0 && (
				<PlaybackControl
					toolSteps={toolSteps}
					currentProgress={currentProgress}
					currentStepIndex={currentStepIndex}
					onProgressChange={handleProgressChange}
					showPlaybackControl={showPlaybackControl}
					userSelectDetail={userSelectDetail}
					status={currentTopicStatus}
					progressOnly={true}
					onPrevStep={handlePrevStep}
					onNextStep={handleNextStep}
					onBackToLatest={shouldShowBackToLatestButton ? handleBackToLatest : undefined}
					className="h-[46px] rounded-b-lg border-t-0 px-3 py-2.5"
				/>
			)}
		</div>
	)
}

export default memo(PlaybackTabContent)
