import {
	IconRefresh,
	IconDownload,
	IconShare3,
	IconMaximize,
	IconMinimize,
} from "@tabler/icons-react"
import ActionButton from "@/pages/superMagic/components/ActionButton"
import { createStyles } from "antd-style"

const useStyles = createStyles(() => ({
	actionButton: {
		width: "24px",
		height: "24px",
	},
}))

interface DesignHeaderActionsProps {
	isRefreshing?: boolean
	isDownloading?: boolean
	isShareRoute: boolean
	isFullscreen?: boolean
	onRefresh?: () => void | Promise<void>
	onDownload?: () => void | Promise<void>
	onShare?: () => void
	onFullscreen?: () => void
	versionMenuTrigger: React.ReactNode
	allowDownload?: boolean
}

export function DesignHeaderActions(props: DesignHeaderActionsProps) {
	const {
		isRefreshing = false,
		isDownloading = false,
		isShareRoute,
		isFullscreen = false,
		onRefresh,
		onDownload,
		onShare,
		onFullscreen,
		versionMenuTrigger,
		allowDownload = true,
	} = props
	const { styles } = useStyles()

	const handleRefresh = async () => {
		if (!onRefresh || isRefreshing) return
		try {
			await onRefresh()
		} catch (error) {
			//
		}
	}

	const handleShare = () => {
		if (onShare) {
			onShare()
		}
	}

	const handleFullscreen = () => {
		if (onFullscreen) {
			onFullscreen()
		}
	}

	const handleDownload = async () => {
		if (!onDownload || isDownloading) return
		try {
			await onDownload()
		} catch (error) {
			//
		}
	}

	return (
		<>
			<ActionButton
				className={styles.actionButton}
				onClick={isRefreshing ? undefined : handleRefresh}
				style={{
					cursor: isRefreshing ? "not-allowed" : "pointer",
					opacity: isRefreshing ? 0.5 : 1,
				}}
			>
				<IconRefresh size={16} stroke={1.5} />
			</ActionButton>
			{allowDownload && (
				<ActionButton
					className={styles.actionButton}
					onClick={isDownloading ? undefined : handleDownload}
					style={{
						cursor: isDownloading ? "not-allowed" : "pointer",
						opacity: isDownloading ? 0.5 : 1,
					}}
				>
					<IconDownload size={16} stroke={1.5} />
				</ActionButton>
			)}
			{!isShareRoute && (
				<ActionButton className={styles.actionButton} onClick={handleShare}>
					<IconShare3 size={16} stroke={1.5} />
				</ActionButton>
			)}
			{onFullscreen && (
				<ActionButton className={styles.actionButton} onClick={handleFullscreen}>
					{isFullscreen ? (
						<IconMinimize size={16} stroke={1.5} />
					) : (
						<IconMaximize size={16} stroke={1.5} />
					)}
				</ActionButton>
			)}
			{!isShareRoute && versionMenuTrigger}
		</>
	)
}
