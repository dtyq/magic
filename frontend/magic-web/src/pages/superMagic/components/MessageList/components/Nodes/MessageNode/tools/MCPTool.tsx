import { Suspense, lazy, memo, type ClipboardEvent, type ReactNode } from "react"
import type { NodeProps } from "../../types"
import type { FileItem } from "@/pages/superMagic/pages/Workspace/types"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useToggleWithScrollPreserve } from "../../shared/hooks/useToggleWithScrollPreserve"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { ScrollArea, ScrollBar } from "@/components/shadcn-ui/scroll-area"
import { useScrollAreaAutoScroll } from "../../shared/hooks/useScrollAreaAutoScroll"
import {
	customTheme,
	syntaxCustomStyle,
	syntaxLineNumberStyle,
} from "../../ToolCall/tools/MCP/syntaxConfig"

const loadSyntaxHighlighter = () =>
	import("react-syntax-highlighter").then((module) => ({
		default: module.Prism,
	}))

const SyntaxHighlighter = lazy(loadSyntaxHighlighter)

interface ToolDataLike {
	id?: string
	name?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	detail?: {
		data?: Record<string, unknown>
	}
	attachments?: FileItem[]
}

interface MCPToolResult {
	name: string
	status: "success" | "fail"
	duration: number
	tools: Array<any>
	tool_count: number
}

interface MCPToolProps extends Partial<NodeProps> {
	toolData?: ToolDataLike
	loading?: boolean
	classNames?: {
		markdown?: string
	}
}

const defaultOpen = false

const mcpToggleButton = cn(
	"ml-auto inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm",
	"hover:bg-fill active:bg-fill-secondary",
)

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

const codeBlock =
	"w-full overflow-auto rounded-[6px] border border-[#e5e5e5] bg-black dark:border-border " +
	"[&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!overflow-auto [&_pre]:!border-none " +
	"[&_pre]:!bg-transparent [&_pre]:!p-2.5 [&_pre]:!text-xs [&_pre]:![line-height:1.5]"

function MCPToolNode(props: MCPToolProps) {
	const { toolData, loading, onMouseEnter, onMouseLeave } = props

	const data = (toolData?.detail?.data || {}) as Record<string, unknown>
	const plugins = (data.server_results || []) as Array<MCPToolResult>
	const formattedParameters = formatJson(data.input_parameters)
	const executionResult = data.execution_result as { content?: string } | undefined
	const formattedResult = parseExecutionResult(executionResult?.content as string)

	const { t } = useTranslation("component")
	const [open, toggle] = useToggleWithScrollPreserve(defaultOpen)

	const { viewportRef } = useScrollAreaAutoScroll({
		isStreaming: !!loading,
	})

	const preloadSyntax = useMemoizedFn(() => {
		void loadSyntaxHighlighter()
	})

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

	const toolDefinition = data.tool_definition as { original_name?: string } | undefined

	return (
		<div
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div
				className={cn(
					"inline-flex w-fit max-w-full flex-col items-center overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-border",
					open && "w-full",
				)}
			>
				<div className="flex w-full items-center gap-1.5">
					<div className="inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg pb-1.5 pl-1.5 pt-1.5 dark:bg-card">
						<ToolIconBadge toolName={toolData?.name} />
						<span className="w-fit flex-none text-xs font-normal not-italic leading-4 text-foreground">
							调用工具
						</span>
						<div className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
							{toolDefinition?.original_name}
						</div>
						{plugins.length > 1 && (
							<div className="line-clamp-1 flex items-center justify-center gap-2.5 overflow-hidden rounded-[1000px] bg-fill px-2.5 py-0.5 text-xs font-normal leading-4 text-muted-foreground">
								+{plugins.length - 1}
							</div>
						)}
					</div>
					<div
						className={cn(mcpToggleButton, "mr-1.5")}
						onClick={toggle}
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
					<div className="w-full self-stretch rounded-[6px] bg-white pb-1.5 pt-0 dark:bg-card">
						<div className="w-full rounded-[6px] bg-white/90 dark:bg-card/90">
							<ScrollArea
								className="w-full"
								viewportClassName="max-h-[320px] pl-1.5 pr-1.5"
								viewportRef={viewportRef}
							>
								<div className="flex w-full flex-col gap-2.5 p-2.5">
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
								<ScrollBar orientation="vertical" />
							</ScrollArea>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export const MCPTool = memo(MCPToolNode)
