import { useCallback, useMemo, useState } from "react"
import type { TFunction } from "i18next"
import {
	Check,
	Clipboard,
	Image as ImageIcon,
	ImageDown,
	LoaderCircle,
	Sparkles,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { useCoverImageUrl } from "../platforms/wechat-official-accounts/useCoverImageUrl"
import type { SelfMediaPost, SelfMediaWechatCoverType } from "../types"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"

const SQUARE_PREVIEW_PROCESS: ImageProcessOptions = {
	resize: { w: 240, h: 240, m: "fill" },
	quality: 82,
	format: "webp",
}

const HORIZONTAL_PREVIEW_PROCESS: ImageProcessOptions = {
	resize: { w: 640, m: "lfit" },
	quality: 82,
	format: "webp",
}

interface WechatExportProductsProps {
	post?: SelfMediaPost
	postIndex: number
	onCopyWechatHtml?: () => Promise<void> | void
	isCopyingWechatHtml?: boolean
	onGenerateWechatCovers?: (args: {
		postIndex: number
		coverTypes: SelfMediaWechatCoverType[]
	}) => Promise<boolean | void> | boolean | void
	generationDisabled?: boolean
}

function CoverPreviewImage({
	url,
	loading,
	alt,
	ratioLabel,
	className,
	testId,
}: {
	url: string | null
	loading: boolean
	alt: string
	ratioLabel: string
	className?: string
	testId?: string
}) {
	return (
		<div className={cn("overflow-hidden bg-white", className)} data-testid={testId}>
			{url ? (
				<img
					src={url}
					alt={alt}
					className="h-full w-full object-cover"
					draggable={false}
					data-testid="export-preview-dialog-image"
				/>
			) : (
				<div
					className={cn(
						"flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#e4e4e7] text-[#71717a]",
						loading && "animate-pulse",
					)}
					aria-label={alt}
				>
					<ImageIcon className="h-4 w-4" aria-hidden />
					<span className="text-[10px] font-medium">{alt}</span>
					<span className="text-[9px] text-[#a1a1aa]">{ratioLabel}</span>
				</div>
			)}
		</div>
	)
}

function getMissingCoverTypes(post?: SelfMediaPost): SelfMediaWechatCoverType[] {
	const missing: SelfMediaWechatCoverType[] = []
	if (!post?.thumbnailCover?.fileId) missing.push("thumbnailCover")
	if (!post?.heroCover?.fileId) missing.push("heroCover")
	return missing
}

function WechatCoverExportPreview({ post }: { post?: SelfMediaPost }) {
	const { t } = useTranslation("super")
	const squareFileId = post?.thumbnailCover?.fileId
	const horizontalFileId = post?.heroCover?.fileId
	const { url: squareUrl, loading: squareLoading } = useCoverImageUrl(
		squareFileId,
		Boolean(squareFileId),
		SQUARE_PREVIEW_PROCESS,
	)
	const { url: horizontalUrl, loading: horizontalLoading } = useCoverImageUrl(
		horizontalFileId,
		Boolean(horizontalFileId),
		HORIZONTAL_PREVIEW_PROCESS,
	)
	const showSeparator = !squareFileId || !horizontalFileId

	return (
		<div
			className="mt-4 grid aspect-[10/3] w-full grid-cols-[3fr_7fr] overflow-hidden rounded-[14px] bg-[#f4f4f5]"
			data-testid="self-media-export-wechat-cover-preview"
		>
			<CoverPreviewImage
				url={squareUrl}
				loading={squareLoading}
				alt={t("detail.selfMedia.export.wechat.squareCover")}
				ratioLabel="1:1"
				className="aspect-square h-full min-w-0"
				testId="self-media-export-wechat-square-preview"
			/>
			<CoverPreviewImage
				url={horizontalUrl}
				loading={horizontalLoading}
				alt={t("detail.selfMedia.export.wechat.horizontalCover")}
				ratioLabel="21:9"
				className={cn(
					"aspect-[21/9] h-full min-w-0",
					showSeparator && "border-l border-[#d4d4d8]",
				)}
				testId="self-media-export-wechat-horizontal-preview"
			/>
		</div>
	)
}

function generationCopy(t: TFunction, missingCoverTypes: SelfMediaWechatCoverType[]) {
	const missingSquare = missingCoverTypes.includes("thumbnailCover")
	const missingHorizontal = missingCoverTypes.includes("heroCover")
	if (missingSquare && missingHorizontal) {
		return {
			title: t("detail.selfMedia.export.wechat.emptyTitle"),
			description: t("detail.selfMedia.export.wechat.emptyDescription"),
			button: t("detail.selfMedia.export.wechat.generateBoth"),
		}
	}
	if (missingHorizontal) {
		return {
			title: t("detail.selfMedia.export.wechat.missingHorizontalTitle"),
			description: t("detail.selfMedia.export.wechat.partialDescription"),
			button: t("detail.selfMedia.export.wechat.generateHorizontal"),
		}
	}
	return {
		title: t("detail.selfMedia.export.wechat.missingSquareTitle"),
		description: t("detail.selfMedia.export.wechat.partialDescription"),
		button: t("detail.selfMedia.export.wechat.generateSquare"),
	}
}

export default function WechatExportProducts({
	post,
	postIndex,
	onCopyWechatHtml,
	isCopyingWechatHtml = false,
	onGenerateWechatCovers,
	generationDisabled = false,
}: WechatExportProductsProps) {
	const { t } = useTranslation("super")
	const [wechatHtmlCopied, setWechatHtmlCopied] = useState(false)
	const [isGeneratingCovers, setIsGeneratingCovers] = useState(false)
	const missingCoverTypes = useMemo(() => getMissingCoverTypes(post), [post])
	const missingCopy = useMemo(() => generationCopy(t, missingCoverTypes), [missingCoverTypes, t])

	const handleCopyWechatHtml = useCallback(async () => {
		if (!onCopyWechatHtml || isCopyingWechatHtml) return
		setWechatHtmlCopied(false)
		try {
			await onCopyWechatHtml()
			setWechatHtmlCopied(true)
		} catch {
			setWechatHtmlCopied(false)
		}
	}, [isCopyingWechatHtml, onCopyWechatHtml])

	const handleGenerateCovers = useCallback(async () => {
		if (
			!onGenerateWechatCovers ||
			generationDisabled ||
			isGeneratingCovers ||
			missingCoverTypes.length === 0
		) {
			return
		}
		setIsGeneratingCovers(true)
		try {
			await onGenerateWechatCovers({ postIndex, coverTypes: missingCoverTypes })
		} finally {
			setIsGeneratingCovers(false)
		}
	}, [
		generationDisabled,
		isGeneratingCovers,
		missingCoverTypes,
		onGenerateWechatCovers,
		postIndex,
	])

	return (
		<div
			className="mx-4 mt-4 grid shrink-0 grid-cols-1 gap-3 rounded-[24px] bg-white/90 p-3 shadow-[inset_0_1px_rgba(255,255,255,0.82)] sm:mx-6 md:grid-cols-2"
			data-testid="self-media-export-wechat-products"
		>
			<section
				className="flex min-h-[160px] flex-col justify-between rounded-[18px] border border-[#e4e4e7] bg-white p-4"
				data-testid="self-media-export-wechat-cover-product"
			>
				<div className="flex items-start gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#07c160]/10 text-[#07c160]">
						<ImageDown className="h-5 w-5" aria-hidden />
					</span>
					<div className="min-w-0">
						<h3 className="text-sm font-[800] text-[#18181b]">
							{t("detail.selfMedia.export.wechat.coverTitle")}
						</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{t("detail.selfMedia.export.wechat.coverDescription")}
						</p>
					</div>
				</div>

				<WechatCoverExportPreview post={post} />

				{missingCoverTypes.length > 0 ? (
					<div
						className="mt-3 flex flex-col gap-3 rounded-[14px] border border-[#07c160]/20 bg-[#07c160]/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between"
						data-testid="self-media-export-wechat-cover-empty-state"
					>
						<div className="min-w-0">
							<p className="text-xs font-semibold text-[#18181b]">
								{missingCopy.title}
							</p>
							<p className="mt-1 text-[11px] leading-4 text-muted-foreground">
								{missingCopy.description}
							</p>
						</div>
						{onGenerateWechatCovers ? (
							<Button
								type="button"
								size="sm"
								className="h-9 shrink-0 rounded-[12px] bg-[#07c160] px-4 text-white hover:bg-[#06ad56]"
								onClick={handleGenerateCovers}
								disabled={generationDisabled || isGeneratingCovers}
								data-testid="self-media-export-generate-wechat-covers"
							>
								{isGeneratingCovers ? (
									<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<Sparkles className="h-4 w-4" aria-hidden />
								)}
								{isGeneratingCovers
									? t("detail.selfMedia.export.wechat.generating")
									: missingCopy.button}
							</Button>
						) : null}
					</div>
				) : null}
			</section>

			<section
				className="flex min-h-[160px] flex-col justify-between rounded-[18px] border border-[#e4e4e7] bg-white p-4"
				data-testid="self-media-export-wechat-html-product"
			>
				<div className="flex items-start gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#18181b]/10 text-[#18181b]">
						<Clipboard className="h-5 w-5" aria-hidden />
					</span>
					<div className="min-w-0">
						<h3 className="text-sm font-[800] text-[#18181b]">
							{t("detail.selfMedia.export.wechat.htmlTitle")}
						</h3>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{t("detail.selfMedia.export.wechat.htmlDescription")}
						</p>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					className={cn(
						"mt-4 h-10 rounded-[14px]",
						selfMediaOverlayStyles.secondaryButton,
					)}
					onClick={handleCopyWechatHtml}
					disabled={!onCopyWechatHtml || isCopyingWechatHtml}
					data-testid="self-media-export-copy-html"
				>
					{wechatHtmlCopied ? (
						<Check className="h-4 w-4" />
					) : (
						<Clipboard className="h-4 w-4" />
					)}
					{wechatHtmlCopied
						? t("detail.selfMedia.export.wechat.htmlCopied")
						: t("detail.selfMedia.export.wechat.copyHtml")}
				</Button>
			</section>
		</div>
	)
}
