import CommonHeaderV2 from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2"
import React, { memo, useRef } from "react"
import { useStyles } from "./style"
import { useFileUrl } from "@/opensource/pages/superMagic/hooks/useFileUrl"
import { Flex } from "antd"
import "xgplayer/dist/index.min.css"
import { useXgPlayer } from "./hooks/useXgPlayer"
import { PlayerStates } from "./components"
import { injectFullscreenStyles } from "./utils"

// Inject fullscreen styles once
injectFullscreenStyles()

interface VideoPreviewProps {
	type?: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	totalFiles?: number
	hasUserSelectDetail?: boolean
	setUserSelectDetail?: (value: boolean) => void
	isFromNode?: boolean
	onClose?: () => void
	isFullscreen?: boolean
	data?: {
		file_name?: string
		file_id?: string
		file_extension?: string
	}
	viewMode?: string
	onViewModeChange?: (mode: string) => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: unknown
	isFavorited?: boolean
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	detailMode?: string
	allowEdit?: boolean
	showFileHeader?: boolean
	attachments?: any[]
	allowDownload?: boolean
}

export function VideoPreview(props: VideoPreviewProps) {
	const { styles } = useStyles()
	const {
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		data,
		onCopy,
		// File sharing props
		currentFile,
		allowEdit,
		showFileHeader = true,
		attachments,
		allowDownload,
	} = props

	const { file_id } = data || {}
	const { fileUrl } = useFileUrl({ file_id: file_id || "" })
	const containerRef = useRef<HTMLDivElement>(null)

	// Use custom hook for player management
	const { isLoading, playerReady } = useXgPlayer({
		fileUrl,
		fileId: file_id,
		containerRef,
	})

	// Download functionality
	const handleDownload = () => {
		if (onDownload) onDownload()
	}

	return (
		<div className={styles.mediaViewer}>
			{showFileHeader && (
				<CommonHeaderV2
					type={type}
					onFullscreen={onFullscreen}
					onDownload={handleDownload}
					isFromNode={isFromNode}
					isFullscreen={isFullscreen}
					onCopy={onCopy}
					currentFile={currentFile}
					showDownload={allowDownload !== false}
					allowEdit={allowEdit}
					attachments={attachments}
				/>
			)}
			<div className={styles.mediaContainer}>
				<Flex className={styles.videoWrapper} justify="center" align="center" vertical>
					<Flex
						justify="center"
						align="center"
						vertical
						className={styles.videoContainer}
					>
						{/* Video player container */}
						{fileUrl && <div ref={containerRef} className={styles.video} />}

						{/* Player states (loading, error, placeholder) */}
						<PlayerStates
							fileUrl={fileUrl}
							fileId={file_id}
							isLoading={isLoading}
							playerReady={playerReady}
							loadingOverlayClassName={styles.loadingOverlay}
							placeholderClassName={styles.videoPlaceholder}
						/>
					</Flex>
				</Flex>
			</div>
		</div>
	)
}

export default memo(VideoPreview)
