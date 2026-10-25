import { useEffect, useRef } from "react"
import { Globe2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import type { MicroAppPreviewBrowser } from "../hooks/useMicroAppPreviewFiles"
import { getMicroAppPreviewPath } from "../utils/microAppFiles"

type Props = Pick<
	MicroAppPreviewBrowser,
	| "previewTabs"
	| "activePreviewTabId"
	| "handlePreviewTabChange"
	| "handlePreviewTabClose"
	| "allowCloseLastTab"
> & { onLastTabClose?: () => void }

export default function MicroAppPreviewTabs({
	previewTabs,
	activePreviewTabId,
	handlePreviewTabChange,
	handlePreviewTabClose,
	allowCloseLastTab,
	onLastTabClose,
}: Props) {
	const { t } = useTranslation("super")
	const viewport = useRef<HTMLDivElement>(null)
	const closePage = (id: string, index: number) => {
		const nextIndex = previewTabs[index + 1] ? index + 1 : index - 1
		handlePreviewTabClose(id)
		if (nextIndex >= 0)
			viewport.current
				?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
				[nextIndex]?.focus()
		else onLastTabClose?.()
	}
	useEffect(() => {
		const selected = viewport.current?.querySelector<HTMLElement>('[aria-selected="true"]')
		selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
	}, [activePreviewTabId])
	return (
		<ScrollArea
			className="min-w-0 flex-1"
			scrollbarOrientation="horizontal"
			viewportRef={viewport}
		>
			<div
				role="tablist"
				aria-label={t("microAppPage.previewToolbar.pages")}
				className="flex h-10 w-max min-w-full items-center gap-1 px-1"
			>
				{previewTabs.map((tab, index) => (
					<div
						key={tab.id}
						className={cn(
							"flex h-8 max-w-60 items-center rounded-md border border-transparent text-muted-foreground hover:bg-muted",
							tab.id === activePreviewTabId &&
								"border-border bg-background text-foreground shadow-xs",
						)}
					>
						<button
							type="button"
							role="tab"
							aria-selected={tab.id === activePreviewTabId}
							tabIndex={tab.id === activePreviewTabId ? 0 : -1}
							className="flex h-full min-w-0 items-center gap-2 rounded-md px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => handlePreviewTabChange(tab.id)}
							onKeyDown={(event) => {
								if (
									event.key === "Delete" &&
									(previewTabs.length > 1 || allowCloseLastTab)
								) {
									event.preventDefault()
									closePage(tab.id, index)
									return
								}
								const next =
									event.key === "ArrowRight"
										? (index + 1) % previewTabs.length
										: event.key === "ArrowLeft"
											? (index - 1 + previewTabs.length) % previewTabs.length
											: event.key === "Home"
												? 0
												: event.key === "End"
													? previewTabs.length - 1
													: -1
								if (next < 0) return
								event.preventDefault()
								handlePreviewTabChange(previewTabs[next].id)
								viewport.current
									?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
									[next]?.focus()
							}}
						>
							<Globe2 size={16} className="shrink-0" />
							<span className="truncate">
								{getMicroAppPreviewPath(tab.file)}
								{tab.file.htmlNavigation?.search}
								{tab.file.htmlNavigation?.hash}
							</span>
						</button>
						{(previewTabs.length > 1 || allowCloseLastTab) && (
							<MagicTooltip title={t("microAppPage.previewToolbar.closePage")}>
								<button
									type="button"
									aria-label={t("microAppPage.previewToolbar.closePage")}
									className="mr-1 flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => closePage(tab.id, index)}
								>
									<X size={16} />
								</button>
							</MagicTooltip>
						)}
					</div>
				))}
			</div>
		</ScrollArea>
	)
}
