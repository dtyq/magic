import { useCallback, useEffect, useState } from "react"
import { Link2, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/utils/cn"
import { getSelfMediaPostActionClassName } from "./SelfMediaPostActionButton"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { SelfMediaPostOpsArtifactAnimation } from "../services/selfMediaOpsArtifactStates"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"
import SelfMediaPostArtifactConfetti from "./SelfMediaPostArtifactConfetti"

interface SelfMediaPostPublishedLinkPopoverProps {
	item: SelfMediaPlatformPostItem
	postId: string
	sourceReady: boolean
	trigger: "action" | "artifact"
	showLabel?: boolean
	artifactReady?: boolean
	artifactReadyClassName?: string
	animation?: SelfMediaPostOpsArtifactAnimation
	localPublishedUrl: string
	onLocalPublishedUrlChange: (url: string) => void
	onLoadPublishedUrl?: (
		target: SelfMediaPlatformPostItem,
	) => Promise<string | undefined> | string | undefined
	onBindPublishedUrl?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl: string,
	) => Promise<boolean | void> | boolean | void
	onPostPublishRefresh?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl?: string,
	) => Promise<void> | void
	autoOpenSignal?: number
}

function SelfMediaPostPublishedLinkPopover({
	item,
	postId,
	sourceReady,
	trigger,
	showLabel,
	artifactReady,
	artifactReadyClassName,
	animation,
	localPublishedUrl,
	onLocalPublishedUrlChange,
	onLoadPublishedUrl,
	onBindPublishedUrl,
	onPostPublishRefresh,
	autoOpenSignal,
}: SelfMediaPostPublishedLinkPopoverProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const [open, setOpen] = useState(false)
	const [linkValue, setLinkValue] = useState(localPublishedUrl)
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState<"save" | "fetch" | null>(null)
	const trimmedLink = linkValue.trim()
	const canSubmit = Boolean(onBindPublishedUrl && trimmedLink && !loading && !submitting)
	const label = t(
		sourceReady
			? "detail.selfMedia.home.editPublishedLink"
			: "detail.selfMedia.home.bindPublishedLink",
	)
	const contentAlign = trigger === "artifact" ? "start" : "end"

	useEffect(() => {
		if (!autoOpenSignal) return
		setOpen(true)
	}, [autoOpenSignal])

	useEffect(() => {
		if (!open) return
		setLinkValue(localPublishedUrl)
		const shouldLoadPublishedUrl =
			trigger === "artifact" || sourceReady || localPublishedUrl.trim().length > 0
		if (!shouldLoadPublishedUrl || !onLoadPublishedUrl) {
			setLoading(false)
			return
		}

		let cancelled = false
		setLoading(true)
		Promise.resolve(onLoadPublishedUrl(item))
			.then((url) => {
				if (cancelled || !url) return
				onLocalPublishedUrlChange(url)
				setLinkValue(url)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [
		item,
		localPublishedUrl,
		onLoadPublishedUrl,
		onLocalPublishedUrlChange,
		open,
		sourceReady,
		trigger,
	])

	const submit = useCallback(
		async (mode: "save" | "fetch") => {
			if (!onBindPublishedUrl || !trimmedLink) return
			setSubmitting(mode)
			try {
				const saved = await onBindPublishedUrl(item, trimmedLink)
				if (saved === false) return
				onLocalPublishedUrlChange(trimmedLink)
				if (mode === "fetch") {
					await onPostPublishRefresh?.(item, trimmedLink)
				}
				setOpen(false)
			} finally {
				setSubmitting(null)
			}
		},
		[item, onBindPublishedUrl, onLocalPublishedUrlChange, onPostPublishRefresh, trimmedLink],
	)

	const triggerButton =
		trigger === "artifact" ? (
			<button
				type="button"
				className={cn(
					"relative flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
					artifactReady ? artifactReadyClassName : "bg-[#f4f4f5] text-[#71717a]/60",
					animation === "updated" && "animate-bounce",
				)}
				aria-label={label}
				title={label}
				data-animation={animation}
				data-ready={artifactReady ? "true" : "false"}
				data-testid={`self-media-home-post-ops-artifact-${postId}-source`}
			>
				{animation === "created" ? (
					<SelfMediaPostArtifactConfetti postId={postId} artifactKey="source" />
				) : null}
				<Link2 className="size-3.5" aria-hidden="true" />
			</button>
		) : (
			<button
				type="button"
				className={getSelfMediaPostActionClassName(
					Boolean(showLabel),
					sourceReady ? "default" : "primary",
				)}
				aria-label={label}
				title={showLabel ? undefined : label}
				data-testid={`self-media-home-post-bind-link-${postId}`}
			>
				<Link2 className="h-3.5 w-3.5 shrink-0" />
				{showLabel ? <span className="whitespace-nowrap">{label}</span> : null}
			</button>
		)

	const formContent = loading ? (
		<div
			className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground"
			data-testid={`self-media-home-post-bind-link-loading-${postId}`}
		>
			<Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
			<span>{t("detail.selfMedia.home.loadingPublishedLink")}</span>
		</div>
	) : (
		<>
			<label
				className="block space-y-1.5"
				data-testid="self-media-post-published-link-popover-label"
			>
				<span className="text-xs font-medium text-foreground">
					{t("detail.selfMedia.home.publishedLinkInput")}
				</span>
				<Input
					value={linkValue}
					onChange={(event) => setLinkValue(event.target.value)}
					placeholder={t("detail.selfMedia.home.publishedLinkPlaceholder")}
					disabled={Boolean(submitting)}
					data-testid={`self-media-home-post-bind-link-input-${postId}`}
				/>
			</label>
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={selfMediaOverlayStyles.secondaryButtonCompact}
					disabled={!canSubmit}
					onClick={() => void submit("save")}
					data-testid={`self-media-home-post-bind-link-save-${postId}`}
				>
					{submitting === "save" ? (
						<Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
					) : null}
					{t("detail.selfMedia.home.bindPublishedLinkAction")}
				</Button>
				<Button
					type="button"
					size="sm"
					className={selfMediaOverlayStyles.primaryButtonCompact}
					disabled={!canSubmit || !onPostPublishRefresh}
					onClick={() => void submit("fetch")}
					data-testid={`self-media-home-post-bind-link-fetch-${postId}`}
				>
					{submitting === "fetch" ? (
						<Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
					) : null}
					{t("detail.selfMedia.home.bindAndFetchPublishedData")}
				</Button>
			</div>
		</>
	)

	if (isMobile) {
		return (
			<>
				{triggerButton && (
					<span onClick={() => setOpen(true)} className="contents">
						{triggerButton}
					</span>
				)}
				<MagicPopup
					visible={open}
					onClose={() => setOpen(false)}
					headerVariant="actionHeader"
					headerTitle={label}
					title={label}
					className="rounded-t-[22px] border-0 bg-[#f8f8f9]"
					bodyClassName="px-4 pb-5 pt-1"
				>
					<div
						className="space-y-4"
						data-testid={`self-media-home-post-bind-link-sheet-${postId}`}
					>
						{formContent}
					</div>
				</MagicPopup>
			</>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
			<PopoverContent
				side="top"
				align={contentAlign}
				className={`w-[min(20rem,calc(100vw-2rem))] space-y-3 p-3 ${selfMediaOverlayStyles.floatingPanel}`}
				data-testid={`self-media-home-post-bind-link-popover-${postId}`}
			>
				{formContent}
			</PopoverContent>
		</Popover>
	)
}

export default SelfMediaPostPublishedLinkPopover
