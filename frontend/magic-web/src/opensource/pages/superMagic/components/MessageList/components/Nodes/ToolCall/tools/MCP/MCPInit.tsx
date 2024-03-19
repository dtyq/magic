import { memo, useMemo, useState, Suspense, lazy } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import type { NodeProps } from "../../../types"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { cn } from "@/opensource/lib/utils"
import { ChevronUp, ChevronRight } from "lucide-react"
import { defaultOpen } from "../../config"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
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

function MCPInitNode(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const plugins = (tool?.detail?.data?.server_results || []) as Array<MCPToolResult>

	const { t } = useTranslation("component")

	const [open, setOpen] = useState(defaultOpen)

	const [successPlugins, failPlugins] = useMemo(() => {
		return [
			plugins.filter((o: any) => o.status === "success"),
			plugins.filter((o: any) => o.status !== "success"),
		]
	}, [plugins])

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
							插件初始化
						</span>
						<div className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
							{plugins?.[0]?.name}
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
						<div className="flex w-full flex-col items-start gap-2 self-stretch rounded-[6px] bg-white/90 p-2.5 dark:bg-card/90">
							{successPlugins.length > 0 && (
								<>
									<div className="text-[12px] leading-[16px] text-foreground">
										{t("mcpInitTool.initSuccess")}
									</div>
									<div className="w-full overflow-auto rounded-[6px] border border-[#e5e5e5] bg-black dark:border-border [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!overflow-auto [&_pre]:!border-none [&_pre]:!bg-transparent [&_pre]:!p-2.5 [&_pre]:!text-xs [&_pre]:![line-height:1.5]">
										<Suspense fallback={null}>
											<SyntaxHighlighter
												language="text"
												style={customTheme}
												customStyle={syntaxCustomStyle}
												showLineNumbers={true}
												lineNumberStyle={syntaxLineNumberStyle}
											>
												{successPlugins.map((p) => p.name).join(", ")}
											</SyntaxHighlighter>
										</Suspense>
									</div>
								</>
							)}
							{failPlugins.length > 0 && (
								<>
									<div className="text-[12px] leading-[16px] text-foreground">
										{t("mcpInitTool.initFailed")}
									</div>
									<div className="w-full overflow-auto rounded-[6px] border border-[#e5e5e5] bg-black dark:border-border [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!overflow-auto [&_pre]:!border-none [&_pre]:!bg-transparent [&_pre]:!p-2.5 [&_pre]:!text-xs [&_pre]:![line-height:1.5]">
										<Suspense fallback={null}>
											<SyntaxHighlighter
												language="text"
												style={customTheme}
												customStyle={syntaxCustomStyle}
												showLineNumbers={true}
												lineNumberStyle={syntaxLineNumberStyle}
											>
												{failPlugins.map((p) => p.name).join(", ")}
											</SyntaxHighlighter>
										</Suspense>
									</div>
								</>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export const MCPInit = memo(observer(MCPInitNode))
