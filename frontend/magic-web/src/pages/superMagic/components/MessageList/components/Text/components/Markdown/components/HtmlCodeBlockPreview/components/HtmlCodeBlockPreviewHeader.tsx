import { IconChevronUp } from "@tabler/icons-react"
import { Check, CodeXml, Copy, Monitor } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/lib/utils"
import type { HtmlCodeBlockPreviewMode } from "../types"
import { HtmlCodeBlockPreviewHtmlIcon } from "./HtmlCodeBlockPreviewHtmlIcon"

interface HtmlCodeBlockPreviewHeaderProps {
	htmlIconId: string
	htmlSnippetLabel: string
	codeModeLabel: string
	previewModeLabel: string
	copyLabel: string
	copySuccessLabel: string
	viewMode: HtmlCodeBlockPreviewMode
	isExpanded: boolean
	isCopied: boolean
	shouldRenderCopyButton: boolean
	shouldRenderViewModeSwitcher: boolean
	onCopy: () => void
	onToggleExpanded: () => void
	onViewModeChange: (mode: string) => void
}

export function HtmlCodeBlockPreviewHeader(props: HtmlCodeBlockPreviewHeaderProps) {
	const {
		htmlIconId,
		htmlSnippetLabel,
		codeModeLabel,
		previewModeLabel,
		copyLabel,
		copySuccessLabel,
		viewMode,
		isExpanded,
		isCopied,
		shouldRenderCopyButton,
		shouldRenderViewModeSwitcher,
		onCopy,
		onToggleExpanded,
		onViewModeChange,
	} = props

	return (
		<div className="flex items-center gap-2">
			<div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
				<span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[6px]">
					<HtmlCodeBlockPreviewHtmlIcon htmlIconId={htmlIconId} />
				</span>
				<span className="truncate text-xs font-normal leading-4 text-foreground">
					{htmlSnippetLabel}
				</span>
			</div>
			<div className="ml-auto flex shrink-0 items-center gap-1.5">
				{shouldRenderViewModeSwitcher && (
					<div
						className="flex h-6 w-[68px] flex-row items-center rounded-[8px] bg-muted p-[2px]"
						data-testid="html-code-block-preview-mode-tabs"
						role="tablist"
						aria-label={htmlSnippetLabel}
					>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<button
										type="button"
										role="tab"
										aria-selected={viewMode === "code"}
										aria-label={codeModeLabel}
										title={codeModeLabel}
										data-state={viewMode === "code" ? "active" : "inactive"}
										className="flex h-5 w-8 items-center justify-center rounded-[6px] border border-transparent px-0 py-0 text-muted-foreground shadow-none transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-4"
										data-testid="html-code-block-preview-tab-code"
										onClick={() => onViewModeChange("code")}
									>
										<CodeXml />
									</button>
								</span>
							</TooltipTrigger>
							<TooltipContent side="top">{codeModeLabel}</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<button
										type="button"
										role="tab"
										aria-selected={viewMode === "desktop"}
										aria-label={previewModeLabel}
										title={previewModeLabel}
										data-state={viewMode === "desktop" ? "active" : "inactive"}
										className="flex h-5 w-8 items-center justify-center rounded-[6px] border border-transparent px-0 py-0 text-muted-foreground shadow-none transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-4"
										data-testid="html-code-block-preview-tab-desktop"
										onClick={() => onViewModeChange("desktop")}
									>
										<Monitor />
									</button>
								</span>
							</TooltipTrigger>
							<TooltipContent side="top">{previewModeLabel}</TooltipContent>
						</Tooltip>
					</div>
				)}
				{shouldRenderCopyButton && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="inline-flex">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={onCopy}
									aria-label={isCopied ? copySuccessLabel : copyLabel}
									className={cn(
										"h-6 w-6 rounded-sm text-muted-foreground hover:bg-transparent hover:text-foreground",
										isCopied && "text-emerald-600 hover:text-emerald-600",
									)}
								>
									{isCopied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent side="top">{copyLabel}</TooltipContent>
					</Tooltip>
				)}
			</div>
			<button
				type="button"
				onClick={onToggleExpanded}
				className="ml-0 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/80"
				aria-label={htmlSnippetLabel}
				data-testid="html-code-block-preview-toggle"
			>
				<IconChevronUp
					size={18}
					className={cn(
						"size-[18px] shrink-0 text-current transition-transform duration-200",
						isExpanded && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</button>
		</div>
	)
}
