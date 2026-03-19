import { memo, useCallback, useMemo } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import "xterm/css/xterm.css"
import "./index.css"
import { useStyles } from "./styles"
import { IconCopy } from "@tabler/icons-react"
import { DetailTerminalData } from "../../types"
import TerminalDisplay from "./components/TerminalDisplay"
import { ActionButton } from "../../components/CommonHeader/components"
import { useResponsive } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"

interface TerminalProps {
	data: DetailTerminalData
	userSelectDetail: any
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	// Props from Render component
	type?: string
	currentIndex?: number
	totalFiles?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	hasUserSelectDetail?: boolean
	isFullscreen?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	// Terminal specific props
	terminalViewMode?: "command" | "result"
	onTerminalViewModeChange?: (mode: "command" | "result") => void

	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	isFavorited?: boolean
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	selectedProject?: any
	allowEdit?: boolean
}

export default memo(function Terminal(props: TerminalProps) {
	const {
		data,
		isFromNode,
		// Props from Render component
		type,
		onFullscreen,
		onDownload,
		isFullscreen,
		// File sharing props
		currentFile,
		className,
		allowEdit,
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const { command, output, exit_code } = data
	const isMobile = useResponsive().md === false

	// 处理复制功能
	const handleTerminalCopy = useCallback(async () => {
		const contentToCopy = command + "\n\n" + output + "\n\n" + `Exit code: ${exit_code}`
		if (!contentToCopy) {
			magicToast.warning(t("terminal.noContentToCopy"))
			return
		}

		try {
			await clipboard.writeText(contentToCopy)
			magicToast.success(t("common.copySuccess"))
		} catch (error) {
			magicToast.error(t("common.copyFailed"))
		}
	}, [command, output, exit_code, t])

	const headerActionConfig = useMemo(
		() => ({
			customActions: [
				{
					key: "terminal-copy",
					zone: "primary" as const,
					render: () => (
						<Flex gap="small" align="center">
							<ActionButton
								icon={IconCopy}
								onClick={handleTerminalCopy}
								title={t("fileViewer.copy")}
								text={!isMobile ? t("fileViewer.copy") : undefined}
								showText={!isMobile}
							/>
						</Flex>
					),
				},
			],
		}),
		[handleTerminalCopy, isMobile, t],
	)

	return (
		<div className={cx(styles.terminalContainer, className)}>
			<CommonHeaderV2
				type={type}
				onFullscreen={onFullscreen}
				onDownload={onDownload}
				isFromNode={isFromNode}
				isFullscreen={isFullscreen}
				// File sharing props
				currentFile={currentFile}
				allowEdit={allowEdit}
				actionConfig={headerActionConfig}
			/>
			<TerminalDisplay
				className={styles.terminalContent}
				command={command}
				output={output}
				exitCode={exit_code}
			/>
		</div>
	)
})
