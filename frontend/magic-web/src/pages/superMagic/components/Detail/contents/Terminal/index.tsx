import { memo, useCallback, useMemo } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { useStyles } from "./styles"
import { Copy, Terminal as TerminalIcon } from "lucide-react"
import { DetailTerminalData, type TerminalToolInfo } from "../../types"
import TerminalDisplay from "./components/TerminalDisplay"
import { TerminalHelpButton } from "./components/TerminalHelpButton"
import { ActionButton } from "../../components/CommonHeader/components"
import magicToast from "@/components/base/MagicToaster/utils"
import type { ActionContext } from "../../components/CommonHeaderV2/types"

interface TerminalProps {
	data: DetailTerminalData
	terminalToolInfo?: TerminalToolInfo
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
		terminalToolInfo,
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
					key: "terminal-title",
					zone: "leading" as const,
					render: () => (
						<div className={styles.title}>
							<TerminalIcon size={16} aria-hidden />
							<span>{t("terminal.title")}</span>
							<span className={styles.readOnly}>{t("terminal.readOnly")}</span>
						</div>
					),
				},
				{
					key: "terminal-guide",
					zone: "secondary" as const,
					render: ({ showButtonText, isMobile }: ActionContext) => (
						<TerminalHelpButton showText={showButtonText && !isMobile} />
					),
				},
				{
					key: "terminal-copy",
					zone: "secondary" as const,
					render: ({ showButtonText, isMobile }: ActionContext) => (
						<Flex gap="small" align="center">
							<ActionButton
								icon={<Copy size={16} />}
								size={16}
								onClick={handleTerminalCopy}
								title={t("fileViewer.copy")}
								text={t("fileViewer.copy")}
								showText={showButtonText && !isMobile}
							/>
						</Flex>
					),
				},
			],
		}),
		[handleTerminalCopy, styles.title, styles.readOnly, t],
	)

	return (
		<div className={cx(styles.terminalContainer, className)}>
			<div className={styles.toolbar}>
				<CommonHeaderV2
					renderMode="actions"
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
			</div>
			<TerminalDisplay
				showControls
				recordKey={terminalToolInfo?.id}
				action={terminalToolInfo?.action}
				remark={terminalToolInfo?.remark}
				className={styles.terminalContent}
				command={command}
				output={output}
				exitCode={exit_code}
			/>
		</div>
	)
})
