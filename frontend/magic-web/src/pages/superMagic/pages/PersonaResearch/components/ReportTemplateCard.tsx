import { useRef, useState } from "react"
import { useInViewport } from "ahooks"
import { ArrowRight, Download, Ellipsis, FileWarning, Sparkles, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import MagicTooltip from "@/components/base/MagicTooltip"
import dayjs from "@/infrastructure/vendors/dayjs"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { cn } from "@/utils/cn"
import { useReportTemplateHtml } from "../hooks/useReportTemplateHtml"
import { PRESSABLE } from "./surface"

interface ReportTemplateCardProps {
	item: AttachmentItem
	name: string
	isDefault: boolean
	onPreview: () => void
	onUse: () => void
	onDownload: () => void
	/** Write actions; absent when the project is read-only. */
	onEditWithAi?: () => void
	onDelete?: () => void
}

/**
 * One template in the library: a live first-screen thumbnail, its name and last change.
 * The thumbnail loads only once the card scrolls into view, so a long library stays light.
 */
export default function ReportTemplateCard({
	item,
	name,
	isDefault,
	onPreview,
	onUse,
	onDownload,
	onEditWithAi,
	onDelete,
}: ReportTemplateCardProps) {
	const { t, i18n } = useTranslation("personaResearch")
	const thumbRef = useRef<HTMLButtonElement>(null)
	const [inViewport] = useInViewport(thumbRef)
	const { html, failed } = useReportTemplateHtml(item, Boolean(inViewport))
	const [rendered, onRendered] = useFrameRendered(html)
	const dayjsLocale = i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en"

	return (
		<div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md">
			<button
				ref={thumbRef}
				type="button"
				onClick={onPreview}
				aria-label={t("reportTemplates.preview", { name })}
				className={cn(
					"relative aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
					PRESSABLE,
				)}
			>
				{html ? (
					// 4x larger page scaled to 25%: the card shows a desktop-width first screen.
					<>
						<ReportTemplateFrame
							html={html}
							title={name}
							inert
							onLoad={onRendered}
							className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25]"
						/>
						{rendered ? null : (
							<Skeleton className="absolute inset-0 h-full w-full rounded-none" />
						)}
					</>
				) : failed ? (
					<span className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
						<FileWarning className="size-4" />
						{t("reportTemplates.thumbFailed")}
					</span>
				) : (
					<Skeleton className="h-full w-full rounded-none" />
				)}
			</button>
			<div className="flex items-center gap-2 px-3 py-2.5">
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="flex items-center gap-1.5">
						<span className="truncate text-sm font-medium">
							{isDefault ? t("reportTemplates.defaultName") : name}
						</span>
						{isDefault ? (
							<Badge
								variant="secondary"
								className="h-5 px-1.5 text-[10px] font-normal"
							>
								{t("reportTemplates.defaultBadge")}
							</Badge>
						) : null}
					</span>
					<span className="text-xs text-muted-foreground">
						{item.updated_at
							? t("reportTemplates.updated", {
									time: dayjs(item.updated_at).locale(dayjsLocale).fromNow(),
								})
							: null}
					</span>
				</div>
				<DropdownMenu>
					<MagicTooltip title={t("reportTemplates.moreActions")}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7 text-muted-foreground"
								aria-label={t("reportTemplates.moreActions")}
							>
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
					</MagicTooltip>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={onUse}>
							<ArrowRight className="size-4" />
							{t("reportTemplates.use")}
						</DropdownMenuItem>
						{onEditWithAi ? (
							<DropdownMenuItem onSelect={onEditWithAi}>
								<Sparkles className="size-4" />
								{t("reportTemplates.editWithAi")}
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onSelect={onDownload}>
							<Download className="size-4" />
							{t("reportTemplates.download")}
						</DropdownMenuItem>
						{onDelete ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-destructive" onSelect={onDelete}>
									<Trash2 className="size-4" />
									{t("reportTemplates.delete")}
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	)
}

/**
 * Renders template HTML in an isolated frame: scripts run (most templates load Tailwind from a
 * CDN), but without same-origin access to this page.
 */
export function ReportTemplateFrame({
	html,
	title,
	inert = false,
	onLoad,
	className,
}: {
	html: string
	title: string
	/** Thumbnails: not reachable by keyboard or pointer. */
	inert?: boolean
	/** Fires once the template's own styles and scripts (often from a CDN) have loaded. */
	onLoad?: () => void
	className?: string
}) {
	return (
		<iframe
			srcDoc={html}
			title={title}
			sandbox="allow-scripts"
			onLoad={onLoad}
			tabIndex={inert ? -1 : undefined}
			aria-hidden={inert || undefined}
			className={cn("border-0 bg-white", className)}
		/>
	)
}

/**
 * Whether a template frame has finished loading. Templates usually pull Tailwind and web fonts
 * from a CDN, so a frame can stay blank for seconds after its HTML arrives; callers show a
 * placeholder until then. Resets when the HTML changes.
 */
export function useFrameRendered(html: string | null): [boolean, () => void] {
	const [renderedHtml, setRenderedHtml] = useState<string | null>(null)
	// The frame's onLoad prop is replaced on every render, so it always reports the current HTML.
	return [Boolean(html) && renderedHtml === html, () => setRenderedHtml(html)]
}
