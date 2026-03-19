import { Suspense, lazy, memo, useState, type ClipboardEvent } from "react"
import { observer } from "mobx-react-lite"
import type { NodeProps } from "../../../types"
import { superMagicStore } from "@/pages/superMagic/stores"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { defaultOpen } from "../../config"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { customTheme, syntaxCustomStyle, syntaxLineNumberStyle } from "./syntaxConfig"

const loadSyntaxHighlighter = () =>
	import("react-syntax-highlighter").then((module) => ({
		default: module.Prism,
	}))

const SyntaxHighlighter = lazy(loadSyntaxHighlighter)

interface MCPToolResult {
	name: string
	status: "success" | "fail"
	duration: number
	tools: Array<any>
	tool_count: number
}

// Shared button toggle classes used by MCP nodes
const mcpToggleButton = cn(
	"ml-auto inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm",
	"hover:bg-fill active:bg-fill-secondary",
)

// Format JSON content for display
const formatJson = (content: any) => {
	try {
		if (typeof content === "string") {
			const parsed = JSON.parse(content)
			return JSON.stringify(parsed, null, 2)
		}
		return JSON.stringify(content, null, 2)
	} catch {
		return typeof content === "string" ? content : JSON.stringify(content, null, 2)
	}
}

// Parse execution_result.content
const parseExecutionResult = (content: string) => {
	if (!content) return null
	try {
		const parsed = JSON.parse(content)
		if (parsed.content && Array.isArray(parsed.content)) {
			const textContent = parsed.content.find((item: any) => item.type === "text")
			if (textContent?.text) {
				try {
					const nestedJson = JSON.parse(textContent.text)
					return JSON.stringify(nestedJson, null, 2)
				} catch {
					return JSON.stringify(textContent.text, null, 2)
				}
			}
		}
		return JSON.stringify(parsed, null, 2)
	} catch {
		return content
	}
}

function MCPToolCallNode(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const plugins = (tool?.detail?.data?.server_results || []) as Array<MCPToolResult>

	const formattedParameters = formatJson(tool?.detail?.data?.input_parameters)
	const formattedResult = parseExecutionResult(tool?.detail?.data?.execution_result?.content)

	const { t } = useTranslation("component")
	const [open, setOpen] = useState(defaultOpen)

	const preloadSyntax = useMemoizedFn(() => {
		void loadSyntaxHighlighter()
	})

	// Filter line numbers from copied text
	const handleCopy = useMemoizedFn((e: ClipboardEvent<HTMLDivElement>) => {
		const selection = window.getSelection()?.toString()
		if (!selection) return

		const cleanedText = selection
			.split("\n")
			.map((line) => line.replace(/^\s*\d+\s*/, ""))
			.filter((line) => {
				const trimmed = line.trim()
				return trimmed !== "" && !/^\d+$/.test(trimmed)
			})
			.join("\n")
			.trim()

		if (e.clipboardData) {
			e.clipboardData.setData("text/plain", cleanedText)
			e.preventDefault()
		}
	})

	const codeBlock =
		"w-full overflow-auto rounded-[6px] border border-[#e5e5e5] bg-black dark:border-border " +
		"[&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!overflow-auto [&_pre]:!border-none " +
		"[&_pre]:!bg-transparent [&_pre]:!p-2.5 [&_pre]:!text-xs [&_pre]:![line-height:1.5]"

	return (
		<div
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div
				className={cn(
					"inline-flex w-fit max-w-full flex-col items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border",
					open && "w-full",
				)}
			>
				<div className="flex w-full items-center gap-1.5">
					<div className="inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg bg-white pb-1.5 pl-1.5 pt-1.5 dark:bg-card">
						<ToolIconBadge toolName={tool?.name} />
						<span className="w-fit flex-none text-xs font-normal not-italic leading-4 text-foreground">
							调用工具
						</span>
						<div className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
							{tool?.detail?.data?.tool_definition?.original_name}
						</div>
						{plugins.length > 1 && (
							<div className="line-clamp-1 flex items-center justify-center gap-2.5 overflow-hidden rounded-[1000px] bg-fill px-2.5 py-0.5 text-xs font-normal leading-4 text-muted-foreground">
								+{plugins.length - 1}
							</div>
						)}
					</div>
					<div
						className={cn(mcpToggleButton, "mr-1.5")}
						onClick={() => setOpen((o) => !o)}
						onMouseEnter={preloadSyntax}
					>
						{open ? (
							<ChevronUp
								size={16}
								className="rotate-180 transition-all duration-100 ease-linear"
							/>
						) : (
							<ChevronRight
								size={16}
								className="transition-all duration-100 ease-linear"
							/>
						)}
					</div>
				</div>
				{open && (
					<div className="w-full self-stretch rounded-[6px] bg-white pb-1.5 pl-1.5 pr-1.5 pt-0 dark:bg-card">
						<div className="w-full">
							<div className="flex max-h-[200px] w-full flex-col items-start gap-2 self-stretch overflow-y-auto rounded-[6px] bg-white/90 p-0 dark:bg-card/90">
								<div className="flex w-full flex-col gap-2.5 overflow-auto p-2.5">
									{/* Parameters Section */}
									<div className="flex flex-col gap-2">
										<span className="text-xs font-normal leading-[1.333] text-foreground">
											{t("mcpTool.parameters")}
										</span>
										<div className={codeBlock} onCopy={handleCopy}>
											<Suspense fallback={null}>
												<SyntaxHighlighter
													language="json"
													style={customTheme}
													customStyle={syntaxCustomStyle}
													showLineNumbers={true}
													lineNumberStyle={syntaxLineNumberStyle}
												>
													{formattedParameters || "NULL"}
												</SyntaxHighlighter>
											</Suspense>
										</div>
									</div>

									{/* Result Section */}
									<div className="flex flex-col gap-2">
										<span className="text-xs font-normal leading-[1.333] text-foreground">
											{t("mcpTool.result")}
										</span>
										<div className={codeBlock} onCopy={handleCopy}>
											<Suspense fallback={null}>
												<SyntaxHighlighter
													language="json"
													style={customTheme}
													customStyle={syntaxCustomStyle}
													showLineNumbers={true}
													lineNumberStyle={syntaxLineNumberStyle}
												>
													{formattedResult || "NULL"}
												</SyntaxHighlighter>
											</Suspense>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export const MCPToolCall = memo(observer(MCPToolCallNode))
