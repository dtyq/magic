import { memo, useCallback, useMemo, useRef, useState } from "react"
import { useThemeMode } from "antd-style"
import { useSize } from "ahooks"
import { Code2, Copy, CircleAlert, CircleCheck, PanelTopClose, PanelTopOpen } from "lucide-react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { useTranslation } from "react-i18next"
import { MonacoEditor, type editor } from "@/infrastructure/editors/monaco"
import { clipboard } from "@/utils/clipboard-helpers"
import magicToast from "@/components/base/MagicToaster/utils"
import { Spinner } from "@/components/shadcn-ui/spinner"
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/shadcn-ui/resizable"
import MagicTooltip from "@/components/base/MagicTooltip"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { ActionButton } from "../../components/CommonHeader/components"
import type { ActionContext } from "../../components/CommonHeaderV2/types"
import type { DetailScriptExecutionData, TerminalToolInfo } from "../../types"
import ScriptOutput from "./ScriptOutput"
import { useStyles } from "./styles"

interface ScriptExecutionProps {
	data: DetailScriptExecutionData
	terminalToolInfo?: TerminalToolInfo
	type?: string
	isFromNode?: boolean
	onFullscreen?: () => void
	onDownload?: () => void
	isFullscreen?: boolean
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	allowEdit?: boolean
	className?: string
	/** 初始代码区占比（百分比）；0 先展示结果，后续尺寸由用户操作决定。 */
	initialCodePanelSize?: number
	/** 嵌入 Helper 的教学示例可关闭入口，避免在教程内重复打开同一教程。 */
	showOutputHelp?: boolean
}

export default memo(function ScriptExecution({
	data,
	terminalToolInfo,
	type,
	isFromNode,
	onFullscreen,
	onDownload,
	isFullscreen,
	currentFile,
	allowEdit,
	className,
	initialCodePanelSize = 35,
	showOutputHelp = true,
}: ScriptExecutionProps) {
	const { styles, cx } = useStyles()
	const { appearance } = useThemeMode()
	const { t } = useTranslation("super")
	const recordKey = terminalToolInfo?.id ?? `script-execution:${data.exit_code}`
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	// 详情可能只是窄侧栏，不能只按浏览器宽度判断；为右侧三个操作保留可见空间。
	const titleMaxWidth = containerSize ? Math.max(160, containerSize.width - 156) : undefined
	const codePanelRef = useRef<ImperativePanelHandle>(null)
	const codeWasExpanded = useRef(initialCodePanelSize > 0)
	const [codeCollapsed, setCodeCollapsed] = useState(initialCodePanelSize === 0)
	const toggleCodeLabel = codeCollapsed
		? t("scriptExecution.expandCode")
		: t("scriptExecution.collapseCode")
	const handleToggleCode = useCallback(() => {
		const panel = codePanelRef.current
		if (panel?.isCollapsed()) {
			// 初始只看结果时，首次展开给代码足够空间；之后由面板恢复用户调整过的比例。
			panel.expand(codeWasExpanded.current ? undefined : 55)
		} else panel?.collapse()
	}, [])

	const handleCopy = useCallback(async () => {
		if (!data.code) {
			magicToast.warning(t("scriptExecution.noCodeToCopy"))
			return
		}

		try {
			await clipboard.writeText(data.code)
			magicToast.success(t("common.copySuccess"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	}, [data.code, t])

	const codeEditorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(
		() => ({
			readOnly: true,
			domReadOnly: true,
			automaticLayout: true,
			minimap: { enabled: false },
			lineNumbers: "on",
			lineNumbersMinChars: 3,
			lineDecorationsWidth: 8,
			folding: true,
			glyphMargin: false,
			wordWrap: "on",
			fontSize: 14,
			lineHeight: 22,
			fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
			padding: { top: 8, bottom: 8 },
			scrollBeyondLastLine: false,
			scrollbar: { vertical: "auto", horizontal: "auto", alwaysConsumeMouseWheel: false },
			contextmenu: false,
			renderLineHighlight: "none",
			overviewRulerLanes: 0,
			largeFileOptimizations: true,
		}),
		[],
	)

	const headerActionConfig = useMemo(
		() => ({
			customActions: [
				{
					key: "script-execution-title",
					zone: "leading" as const,
					render: () => (
						<div className={styles.title} style={{ maxWidth: titleMaxWidth }}>
							<Code2 size={16} aria-hidden />
							<span>{t("scriptExecution.title")}</span>
							<span className={styles.readOnly}>{t("terminal.readOnly")}</span>
							<span
								className={cx(styles.status, !data.success && styles.error)}
								role="status"
							>
								{data.success ? (
									<CircleCheck size={16} aria-hidden />
								) : (
									<CircleAlert size={16} aria-hidden />
								)}
								<span>
									{data.success
										? t("terminal.returnedNormally")
										: t("terminal.returnedWithError")}
								</span>
								<span className={styles.exitCode}>
									{t("terminal.exitCode")}: {data.exit_code}
								</span>
							</span>
						</div>
					),
				},
				{
					key: "script-execution-toggle-code",
					zone: "secondary" as const,
					render: ({ showButtonText, isMobile }: ActionContext) => (
						<MagicTooltip
							title={toggleCodeLabel}
							disabled={showButtonText && !isMobile}
						>
							<button
								type="button"
								className={styles.toggleCode}
								onClick={handleToggleCode}
								aria-label={toggleCodeLabel}
								aria-expanded={!codeCollapsed}
							>
								{codeCollapsed ? (
									<PanelTopOpen size={16} aria-hidden />
								) : (
									<PanelTopClose size={16} aria-hidden />
								)}
								{showButtonText && !isMobile && <span>{toggleCodeLabel}</span>}
							</button>
						</MagicTooltip>
					),
				},
				{
					key: "script-execution-copy",
					zone: "secondary" as const,
					render: ({ showButtonText, isMobile }: ActionContext) => (
						<ActionButton
							icon={<Copy size={16} />}
							size={16}
							onClick={handleCopy}
							title={t("scriptExecution.copyCode")}
							text={t("scriptExecution.copyCode")}
							showText={showButtonText && !isMobile}
						/>
					),
				},
			],
		}),
		[
			codeCollapsed,
			cx,
			data.exit_code,
			data.success,
			handleCopy,
			handleToggleCode,
			styles.error,
			styles.exitCode,
			styles.readOnly,
			styles.status,
			styles.title,
			styles.toggleCode,
			toggleCodeLabel,
			titleMaxWidth,
			t,
		],
	)

	return (
		<div ref={containerRef} className={cx(styles.scriptExecutionContainer, className)}>
			<div className={styles.toolbar}>
				<CommonHeaderV2
					renderMode="actions"
					type={type}
					onFullscreen={onFullscreen}
					onDownload={onDownload}
					isFromNode={isFromNode}
					isFullscreen={isFullscreen}
					currentFile={currentFile}
					allowEdit={allowEdit}
					actionConfig={headerActionConfig}
				/>
			</div>
			<div className={styles.content}>
				<ResizablePanelGroup direction="vertical" className={styles.panelGroup}>
					<ResizablePanel
						ref={codePanelRef}
						order={1}
						defaultSize={initialCodePanelSize}
						minSize={20}
						collapsible
						collapsedSize={0}
						onCollapse={() => setCodeCollapsed(true)}
						onExpand={() => {
							codeWasExpanded.current = true
							setCodeCollapsed(false)
						}}
					>
						<section
							className={styles.section}
							aria-label={t("scriptExecution.code")}
							style={{ visibility: codeCollapsed ? "hidden" : undefined }}
						>
							<div className={styles.sectionHeader}>{t("scriptExecution.code")}</div>
							<div className={styles.codeBody}>
								<MonacoEditor
									key={`code:${recordKey}`}
									height="100%"
									language="python"
									value={data.code}
									options={codeEditorOptions}
									theme={appearance === "dark" ? "vs-dark" : "light"}
									loading={
										<div className={styles.loading}>
											<Spinner size={20} />
										</div>
									}
								/>
							</div>
						</section>
					</ResizablePanel>
					<ResizableHandle
						withHandle
						aria-label={t("scriptExecution.resizePanels")}
						className={styles.resizeHandle}
					/>
					<ResizablePanel order={2} defaultSize={100 - initialCodePanelSize} minSize={30}>
						<section
							className={styles.section}
							aria-label={t("scriptExecution.output")}
						>
							<ScriptOutput
								key={recordKey}
								data={data}
								recordKey={recordKey}
								showHelp={showOutputHelp}
							/>
						</section>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	)
})
