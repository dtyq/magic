import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlignLeft, TriangleAlert } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { cn } from "@/utils/cn"
import type { DetailScriptExecutionData } from "../../types"
import { TerminalOutput } from "../Terminal/components/TerminalOutput"
import ScriptOutputHelp from "./ScriptOutputHelp"

type OutputStream = "stdout" | "stderr"

interface ScriptOutputProps {
	data: DetailScriptExecutionData
	recordKey: string
	showHelp?: boolean
}

export default function ScriptOutput({ data, recordKey, showHelp = true }: ScriptOutputProps) {
	const { t } = useTranslation("super")
	// 初次打开优先显示失败原因或唯一非空输出；后续数据更新不抢走用户选择。
	const [stream, setStream] = useState<OutputStream>(() =>
		(!data.success && data.stderr) || (!data.stdout && data.stderr) ? "stderr" : "stdout",
	)
	const streams = [
		{ key: "stdout", label: t("scriptExecution.stdout"), content: data.stdout },
		{ key: "stderr", label: t("scriptExecution.stderr"), content: data.stderr },
	] satisfies { key: OutputStream; label: string; content: string }[]
	const hasOutput = Boolean(data.stdout || data.stderr)

	return (
		<Tabs
			value={stream}
			onValueChange={(value) => setStream(value as OutputStream)}
			className="h-full min-h-0 min-w-0 gap-0"
		>
			<div className="shrink-0 border-b border-border px-3 py-2">
				<div className="flex items-center gap-1.5">
					<TabsList
						aria-label={t("scriptExecution.output")}
						className="h-auto min-w-0 flex-wrap gap-1 rounded-lg bg-muted/60 p-1"
					>
						{streams.map(({ key, label, content }) => (
							<TabsTrigger
								key={key}
								value={key}
								className="h-8 flex-1 cursor-pointer gap-1.5 rounded-md border border-transparent px-2 text-[13px] text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-primary/30 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:border-primary/30 dark:data-[state=active]:bg-background dark:data-[state=active]:text-primary"
							>
								{key === "stdout" ? (
									<AlignLeft size={15} aria-hidden className="shrink-0" />
								) : (
									<TriangleAlert size={15} aria-hidden className="shrink-0" />
								)}
								{label}
								<span
									className={cn(
										"rounded px-1.5 py-0.5 text-[11px] font-normal",
										content
											? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
											: "bg-muted text-muted-foreground",
									)}
								>
									{t(
										content
											? "scriptExecution.hasOutput"
											: "scriptExecution.noOutput",
									)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
					{showHelp && <ScriptOutputHelp />}
				</div>
			</div>
			{streams.map(({ key, content }) => (
				// 保留两份阅读器的搜索、选择和滚动位置；隐藏页不参与布局或键盘焦点。
				<TabsContent
					key={key}
					value={key}
					forceMount
					className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
				>
					{content ? (
						<TerminalOutput
							content={content}
							recordKey={`${recordKey}:${key}`}
							showControls
							toolbarVariant="embedded"
						/>
					) : (
						<div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4 text-[13px] text-muted-foreground">
							{hasOutput
								? t("scriptExecution.noOutput")
								: t("scriptExecution.noExecutionOutput")}
						</div>
					)}
				</TabsContent>
			))}
		</Tabs>
	)
}
