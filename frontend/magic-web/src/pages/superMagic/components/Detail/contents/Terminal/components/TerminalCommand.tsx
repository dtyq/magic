import { useEffect, useId, useRef, useState } from "react"
import { ChevronsDown, ChevronsUp, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { clipboard } from "@/utils/clipboard-helpers"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/utils/cn"
import SmartTooltip from "@/components/other/SmartTooltip"

interface TerminalCommandProps {
	command: string
	action?: string
	remark?: string
}

export function TerminalCommand({ command, action, remark }: TerminalCommandProps) {
	const { t } = useTranslation("super")
	const contentId = useId()
	const commandRef = useRef<HTMLPreElement>(null)
	const remarkRef = useRef<HTMLButtonElement>(null)
	const [expanded, setExpanded] = useState(false)
	const [overflows, setOverflows] = useState(false)
	const [remarkOverflows, setRemarkOverflows] = useState(false)
	useEffect(() => {
		const element = commandRef.current
		const remarkElement = remarkRef.current
		if (!element && !remarkElement) return
		const measure = () => {
			if (element && !expanded) setOverflows(element.scrollHeight > element.clientHeight + 1)
			if (remarkElement)
				setRemarkOverflows(remarkElement.scrollWidth > remarkElement.clientWidth)
		}
		measure()
		// 复用尺寸观察：命令按高度展开，说明只在被截断时提供键盘与点击入口。
		const observer = new ResizeObserver(measure)
		if (element) observer.observe(element)
		if (remarkElement) observer.observe(remarkElement)
		return () => observer.disconnect()
	}, [command, expanded, remark])

	async function copyCommand() {
		try {
			await clipboard.writeText(command)
			magicToast.success(t("terminal.copyCommand"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	}

	return (
		<>
			{remark && remark !== command && (
				<div className="flex min-w-0 shrink-0 items-center gap-3 border-b border-border px-4 py-3 text-sm leading-[22px] text-foreground">
					<span className="shrink-0 font-medium">
						{action || t("terminal.operation")}
					</span>
					{/* 保留工具实际返回的说明；不推断用途，不重复展开同一段文字。 */}
					<SmartTooltip
						className="min-w-0 flex-1 leading-[22px]"
						content={remark}
						forceShowTooltip={remarkOverflows}
						trigger={["hover", "focus", "click"]}
						sideOffset={4}
					>
						<button
							ref={remarkRef}
							type="button"
							disabled={!remarkOverflows}
							className="block w-full truncate rounded-sm bg-transparent p-0 text-left font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-text [@media(pointer:coarse)]:enabled:min-h-11"
						>
							{remark}
						</button>
					</SmartTooltip>
				</div>
			)}
			{command && (
				<section className="shrink-0 px-4 pb-4 pt-3" aria-label={t("terminal.command")}>
					<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground">
						<span className="font-medium">{t("terminal.actualCommand")}</span>
						<div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
							<Button
								variant="ghost"
								size="sm"
								className="h-8 gap-1.5 px-2 text-sm font-normal [@media(pointer:coarse)]:min-h-11"
								onClick={copyCommand}
							>
								<Copy size={16} aria-hidden />
								{t("terminal.copyCommandAction")}
							</Button>
							{(overflows || expanded) && (
								<Button
									variant="ghost"
									size="sm"
									className="h-8 gap-1.5 px-2 text-sm font-normal [@media(pointer:coarse)]:min-h-11"
									aria-expanded={expanded}
									aria-controls={contentId}
									onClick={() => setExpanded((value) => !value)}
								>
									{expanded ? (
										<ChevronsUp size={16} aria-hidden />
									) : (
										<ChevronsDown size={16} aria-hidden />
									)}
									{expanded
										? t("terminal.collapseCommand")
										: t("terminal.expandCommand")}
								</Button>
							)}
						</div>
					</div>
					<div className="mt-1 flex min-w-0 gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm leading-[22px]">
						<span
							className="select-none text-green-700 dark:text-green-400"
							aria-hidden
						>
							$
						</span>
						<pre
							ref={commandRef}
							id={contentId}
							className={cn(
								"m-0 min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm leading-[22px] text-blue-600 dark:text-blue-400",
								expanded
									? "max-h-[220px] overflow-auto"
									: "max-h-[66px] overflow-hidden",
							)}
						>
							{command}
						</pre>
					</div>
				</section>
			)}
		</>
	)
}
