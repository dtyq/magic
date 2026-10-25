import type { AssetItem } from "@/apis"
import MagicTooltip from "@/components/base/MagicTooltip"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import {
	Check,
	Ellipsis,
	FileQuestion,
	Image as ImageIcon,
	LoaderCircle,
	Music2,
	Play,
	ShieldAlert,
	ShieldCheck,
	ShieldQuestion,
	Video,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TFunction } from "../../../public/i18n-types"
import { assetDetailStore } from "../../../runtime/resources/asset/AssetDetailStore"
import { rememberAssetMediaDimensions } from "../../../runtime/resources/asset/assetMediaDimensionCache"
import { formatAssetDuration } from "./assetLibraryMedia"
import { canStartAssetLibraryCompliance } from "./useAssetLibraryComplianceAction"

interface AssetLibraryAssetCardProps {
	asset: AssetItem
	selected: boolean
	selectionBlocked: boolean
	t: TFunction
	manageable?: boolean
	onToggle: (assetId: string) => void
	onPreview: (asset: AssetItem) => void
	onEdit?: (asset: AssetItem) => void
	onTransferOwner?: (asset: AssetItem) => void
	onDelete?: (asset: AssetItem) => void
	onMenuOpenChange?: (open: boolean) => void
	onComplianceCheck?: (asset: AssetItem) => void
	complianceActionPending?: boolean
	seedanceComplianceAvailable?: boolean
}

function getAssetVisibilityLabel(asset: AssetItem, t: TFunction): string {
	// visibility_type only encodes PERSONAL and TEAM. Official assets stay on source.
	if (asset.source === "PUBLIC") return t("assets.publicVisible", "官方公开")
	if (asset.visibility_type === "TEAM") return t("assets.teamVisible", "团队可见")
	if (asset.visibility_type === "PERSONAL") return t("assets.personalVisible", "仅自己可见")
	// Older list payloads omit visibility_type.
	if (asset.source === "TEAM") return t("assets.teamVisible", "团队可见")
	return t("assets.personalVisible", "仅自己可见")
}

function getAssetComplianceLabel(asset: AssetItem, t: TFunction): string {
	switch (asset.compliance_status) {
		case "PASS":
			return t("assets.compliancePassed", "已通过合规检查")
		case "PROCESSING":
			return t("assets.complianceProcessing", "合规校验中")
		case "FAILED":
			return t("assets.complianceFailed", "合规校验失败")
		default:
			return t("assets.complianceUnverified", "未校验")
	}
}

function FullscreenCornersIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
			<path
				d="M4 0.75H0.75V4 M10 0.75H13.25V4 M0.75 10V13.25H4 M13.25 10V13.25H10"
				fill="none"
				stroke="#FAFAFA"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function AssetLibraryAssetCard({
	asset,
	selected,
	selectionBlocked,
	t,
	manageable = false,
	onToggle,
	onPreview,
	onEdit,
	onTransferOwner,
	onDelete,
	onMenuOpenChange,
	onComplianceCheck,
	complianceActionPending = false,
	seedanceComplianceAvailable = false,
}: AssetLibraryAssetCardProps) {
	const [displayAsset, setDisplayAsset] = useState(asset)
	const [durationLabel, setDurationLabel] = useState("")
	const [mediaInView, setMediaInView] = useState(false)
	const mediaContainerRef = useRef<HTMLDivElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)
	const previewFrameLoadRequestedRef = useRef(false)
	const previewFrameSeekRequestedRef = useRef(false)

	useEffect(() => {
		setDisplayAsset(asset)
		setDurationLabel("")
		// A legacy list response can omit the media type or URL. Hydrate only those
		// cards; preview rendering must not refresh a link merely because expires_at
		// is present or close to its deadline. Expiry refresh belongs to real resource
		// consumers, not this preview card.
		if (asset.asset_media_type && Boolean(asset.file_url)) return
		let active = true
		void assetDetailStore
			.get(asset.asset_id)
			.then((detail) => {
				if (active) setDisplayAsset(detail)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [asset])

	const requestPreviewFrame = useCallback(() => {
		if (
			displayAsset.asset_media_type !== "VIDEO" ||
			Boolean(displayAsset.thumbnail_url) ||
			!mediaInView ||
			previewFrameSeekRequestedRef.current
		) {
			return
		}

		const video = videoRef.current
		if (!video) return

		// `preload="metadata"` is enough for the duration label, but Safari may
		// stop at HAVE_METADATA and leave a poster-less paused video blank. Only
		// visible cards opt into the extra data request.
		video.preload = "auto"
		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
			if (!previewFrameLoadRequestedRef.current) {
				previewFrameLoadRequestedRef.current = true
				try {
					video.load()
				} catch {
					previewFrameLoadRequestedRef.current = false
				}
				return
			}
			if (video.readyState < HTMLMediaElement.HAVE_METADATA) return
		}

		const targetTime =
			Number.isFinite(video.duration) && video.duration > 0
				? Math.min(0.001, Math.max(0, video.duration - 0.001))
				: 0.001
		previewFrameSeekRequestedRef.current = true
		try {
			// Requesting a near-zero frame only for visible cards advances it to a
			// drawable state without starting playback for every asset in the library.
			video.currentTime = targetTime
		} catch {
			previewFrameSeekRequestedRef.current = false
		}
	}, [displayAsset.asset_media_type, displayAsset.thumbnail_url, mediaInView])

	useEffect(() => {
		previewFrameLoadRequestedRef.current = false
		previewFrameSeekRequestedRef.current = false
		setMediaInView(false)
		if (displayAsset.asset_media_type !== "VIDEO" || Boolean(displayAsset.thumbnail_url)) {
			return
		}

		const container = mediaContainerRef.current
		if (!container || typeof IntersectionObserver === "undefined") {
			setMediaInView(true)
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setMediaInView(true)
				observer.disconnect()
			},
			{ rootMargin: "120px" },
		)
		observer.observe(container)
		return () => observer.disconnect()
	}, [
		displayAsset.asset_id,
		displayAsset.asset_media_type,
		displayAsset.file_url,
		displayAsset.thumbnail_url,
	])

	useEffect(() => {
		requestPreviewFrame()
	}, [requestPreviewFrame])

	const previewUrl = displayAsset.thumbnail_url || displayAsset.file_url || undefined
	const mediaLabel =
		displayAsset.asset_media_type === "VIDEO"
			? t("assets.mediaVideo", "视频")
			: displayAsset.asset_media_type === "AUDIO"
				? t("assets.mediaAudio", "音频")
				: displayAsset.asset_media_type === "IMAGE"
					? t("assets.mediaImage", "图片")
					: t("assets.mediaUnknown", "未知类型")
	const visibilityLabel = getAssetVisibilityLabel(displayAsset, t)
	const complianceLabel = getAssetComplianceLabel(displayAsset, t)
	const complianceBadgeClassName = cn(
		// Keep the preview corner compact; the full status text is available from the tooltip.
		"inline-flex h-6 items-center overflow-hidden rounded-md shadow-sm",
		displayAsset.compliance_status === "PASS" && "bg-primary text-primary-foreground",
		displayAsset.compliance_status === "PROCESSING" && "bg-background/90 text-foreground",
		displayAsset.compliance_status === "FAILED" && "bg-destructive text-destructive-foreground",
		displayAsset.compliance_status === "UNVERIFIED" && "bg-background/90 text-muted-foreground",
	)
	const complianceBadgeIcon =
		displayAsset.compliance_status === "PASS" ? (
			<ShieldCheck className="size-3.5" aria-hidden="true" />
		) : displayAsset.compliance_status === "FAILED" ? (
			<ShieldAlert className="size-3.5" aria-hidden="true" />
		) : displayAsset.compliance_status === "PROCESSING" ? (
			<LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
		) : (
			<ShieldQuestion className="size-3.5" aria-hidden="true" />
		)
	const showComplianceAction =
		manageable && Boolean(onComplianceCheck) && canStartAssetLibraryCompliance(displayAsset)
	const showActionsMenu = manageable || showComplianceAction
	const seedanceComplianceLabel = t("contextMenu.seedanceCompliance", "Seedance 合规校验")
	const complianceFailedReason =
		displayAsset.compliance_status === "FAILED"
			? (displayAsset.compliance_failed_reason?.trim() ?? "")
			: ""
	const complianceTooltipTitle =
		displayAsset.compliance_status === "FAILED" && complianceFailedReason
			? complianceFailedReason
			: complianceLabel
	const complianceBadge = (
		<span className={complianceBadgeClassName} role="img" aria-label={complianceTooltipTitle}>
			<span className="inline-flex size-6 shrink-0 items-center justify-center">
				{complianceBadgeIcon}
			</span>
		</span>
	)

	return (
		<div
			role="button"
			tabIndex={selectionBlocked ? -1 : 0}
			aria-pressed={selected}
			className={cn(
				"flex h-[320px] flex-col overflow-hidden rounded-xl border bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				selected && "ring-2 ring-primary/15",
				!selected && "hover:border-primary/60",
				selectionBlocked && "cursor-not-allowed opacity-60",
			)}
			onClick={() => {
				if (!selectionBlocked) onToggle(asset.asset_id)
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault()
					if (!selectionBlocked) onToggle(asset.asset_id)
				}
			}}
		>
			<div
				ref={mediaContainerRef}
				className="group relative h-[220px] shrink-0 overflow-hidden bg-muted"
			>
				{displayAsset.file_url && displayAsset.asset_media_type ? (
					displayAsset.asset_media_type === "VIDEO" ? (
						<video
							ref={videoRef}
							className="block size-full object-contain"
							src={displayAsset.file_url}
							poster={displayAsset.thumbnail_url ?? undefined}
							aria-label={displayAsset.name}
							muted
							playsInline
							preload={
								displayAsset.thumbnail_url || !mediaInView ? "metadata" : "auto"
							}
							onLoadedMetadata={(event) => {
								const video = event.currentTarget
								rememberAssetMediaDimensions(displayAsset.asset_id, {
									width: video.videoWidth,
									height: video.videoHeight,
								})
								const label = formatAssetDuration(video.duration)
								if (label) setDurationLabel(label)
								requestPreviewFrame()
							}}
							onLoadedData={() => requestPreviewFrame()}
						/>
					) : displayAsset.asset_media_type === "AUDIO" ? (
						<div className="flex size-full items-center justify-center">
							<Music2 className="size-12 text-muted-foreground" />
						</div>
					) : (
						<img
							className="block size-full object-contain"
							src={previewUrl}
							alt={displayAsset.name}
							onLoad={(event) => {
								const image = event.currentTarget
								rememberAssetMediaDimensions(displayAsset.asset_id, {
									width: image.naturalWidth,
									height: image.naturalHeight,
								})
							}}
						/>
					)
				) : (
					<div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-accent">
						{displayAsset.asset_media_type === "VIDEO" ? (
							<Video className="size-12 text-muted-foreground" />
						) : displayAsset.asset_media_type === "AUDIO" ? (
							<Music2 className="size-12 text-muted-foreground" />
						) : !displayAsset.asset_media_type ? (
							<FileQuestion className="size-12 text-muted-foreground" />
						) : (
							<ImageIcon className="size-12 text-muted-foreground" />
						)}
					</div>
				)}
				{selected ? (
					<span className="absolute left-2.5 top-2.5 inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
						<Check className="size-4" aria-hidden="true" />
					</span>
				) : null}
				<div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
					{seedanceComplianceAvailable ? (
						<MagicTooltip
							title={complianceTooltipTitle}
							placement="top"
							delayDuration={0}
						>
							{complianceBadge}
						</MagicTooltip>
					) : null}
					{showActionsMenu ? (
						<DropdownMenu modal={false} onOpenChange={onMenuOpenChange}>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex size-6 items-center justify-center rounded-md border border-white bg-background/90 text-foreground shadow-sm hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									aria-label={t("assets.actions", "素材操作")}
									onPointerDown={(event) => event.stopPropagation()}
									onClick={(event) => event.stopPropagation()}
								>
									<Ellipsis className="size-4" aria-hidden="true" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => event.stopPropagation()}
							>
								{showComplianceAction ? (
									<DropdownMenuItem
										disabled={complianceActionPending}
										onSelect={() => onComplianceCheck?.(displayAsset)}
									>
										{seedanceComplianceLabel}
									</DropdownMenuItem>
								) : null}
								{manageable ? (
									<>
										<DropdownMenuItem onSelect={() => onEdit?.(displayAsset)}>
											{t("assets.edit", "编辑素材")}
										</DropdownMenuItem>
										<DropdownMenuItem
											onSelect={() => onTransferOwner?.(displayAsset)}
										>
											{t("assets.transferOwner", "转移归属人")}
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => onDelete?.(displayAsset)}
										>
											{t("assets.delete", "删除素材")}
										</DropdownMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
				{displayAsset.asset_media_type === "VIDEO" ? (
					<span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs leading-4 text-white">
						<Play className="size-3 fill-white" aria-hidden="true" />
						{durationLabel || null}
					</span>
				) : null}
				{displayAsset.file_url &&
				(displayAsset.asset_media_type === "IMAGE" ||
					displayAsset.asset_media_type === "VIDEO") ? (
					<button
						type="button"
						className="absolute bottom-2.5 right-2.5 inline-flex size-6 items-center justify-center rounded-lg bg-[rgba(0,0,0,0.70)] opacity-0 transition-opacity hover:bg-[rgba(0,0,0,0.85)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
						aria-label={t("assets.preview", "放大预览")}
						onClick={(event) => {
							event.stopPropagation()
							onPreview(displayAsset)
						}}
					>
						<FullscreenCornersIcon />
					</button>
				) : null}
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
				<div
					className="truncate text-base font-semibold leading-6"
					title={displayAsset.name}
				>
					{displayAsset.name}
				</div>
				<div className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">
					{mediaLabel} · {visibilityLabel}
				</div>
				<div className="mt-2 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-hidden">
					{displayAsset.tags.map((tag) => (
						<span
							key={tag.id}
							className="rounded bg-accent px-1.5 py-0.5 text-xs leading-[18px] text-primary"
						>
							{tag.name}
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
