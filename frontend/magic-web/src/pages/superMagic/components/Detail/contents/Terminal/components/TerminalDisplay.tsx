import { useMemo } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import { formatTerminalTranscript } from "./terminal-buffer"
import { TerminalCommand } from "./TerminalCommand"
import { TerminalOutput } from "./TerminalOutput"

interface TerminalDisplayProps {
	command: string
	output?: string
	exitCode?: number | string
	className?: string
	showControls?: boolean
	recordKey?: string
	action?: string
	remark?: string
}

function TerminalDisplay({
	command,
	output = "",
	exitCode,
	className,
	showControls = false,
	recordKey = command,
	action,
	remark,
}: TerminalDisplayProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const hasExitCode = typeof exitCode === "number" && Number.isFinite(exitCode)
	const hasExecutionError = hasExitCode && exitCode < 0
	const hasNonzeroExitCode = hasExitCode && exitCode > 0
	// 详情分开呈现命令与输出；消息内嵌预览沿用完整终端记录和原有高度约束。
	const content = useMemo(
		() => (showControls ? output : formatTerminalTranscript(command, output)),
		[command, output, showControls],
	)

	// 同级命令区与输出区必须使用不同 key，切换记录时才能完整卸载旧内容。
	return (
		<div className={cx(styles.terminalDisplay, showControls && styles.detailView, className)}>
			{showControls && (
				<TerminalCommand
					key={`command:${recordKey}`}
					command={command}
					action={action}
					remark={remark}
				/>
			)}
			<TerminalOutput
				key={`output:${recordKey}`}
				content={content}
				recordKey={recordKey}
				showControls={showControls}
			/>
			<div
				className={cx(
					styles.footer,
					showControls && styles.detailFooter,
					hasExecutionError && styles.error,
					hasNonzeroExitCode && styles.warning,
				)}
				role="status"
			>
				{hasExitCode && (
					<>
						{/* 负值是工具异常哨兵；正值表示命令已返回，仍需结合输出判断。 */}
						<span className={styles.status}>
							{hasExecutionError || hasNonzeroExitCode ? (
								<CircleAlert size={16} aria-hidden />
							) : (
								<CircleCheck size={16} aria-hidden />
							)}
							{hasExecutionError
								? t("terminal.returnedWithError")
								: hasNonzeroExitCode
									? t("terminal.returnedWithNonzeroExitCode")
									: t("terminal.returnedNormally")}
						</span>
						<span
							className={cx(styles.exitCode, showControls && styles.detailExitCode)}
						>
							{t("terminal.exitCode")}
							<span className={styles.exitCodeValue} data-terminal-exit-code>
								{exitCode}
							</span>
						</span>
					</>
				)}
			</div>
		</div>
	)
}

export default TerminalDisplay
