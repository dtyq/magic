import { type ReactNode, type Ref } from "react"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import type { SelfMediaInitData, OutlineNode } from "../types"
import { collectArticleMaterials } from "../types"
import type { SelfMediaPlatform } from "../../../../../types"
import type { ArticleBatchTopicItem } from "../../../services/selfMediaBatchSend"
import {
	Briefcase,
	CheckCircle,
	Image as ImageIcon,
	Loader2,
	Target,
	UserRound,
	UsersRound,
	type LucideIcon,
} from "lucide-react"
import PlatformBrandIcon from "../../PlatformBrandIcon"

type TranslateOptions = Record<string, unknown> | string

export type StepConfirmTranslate = (key: string, opts?: TranslateOptions) => string

function isCardBasedPlatform(platform?: SelfMediaPlatform): boolean {
	return platform === "rednote" || platform === "instagram"
}

function countOutlineNodes(nodes: OutlineNode[]): number {
	return nodes.reduce((total, node) => total + 1 + countOutlineNodes(node.children || []), 0)
}

function getArticleReadyHintKey(outlineCount: number, materialCount: number): string {
	if (outlineCount > 0 && materialCount > 0) {
		return "detail.selfMedia.initPanel.stepConfirm.articleReadyHint"
	}
	if (outlineCount > 0) {
		return "detail.selfMedia.initPanel.stepConfirm.articleReadyHintOutline"
	}
	return "detail.selfMedia.initPanel.stepConfirm.articleReadyHintMaterials"
}

function getArticleReadyHintDefaultValue(outlineCount: number, materialCount: number): string {
	if (outlineCount > 0 && materialCount > 0) {
		return "已整理 {{outlineCount}} 个大纲要点和 {{materialCount}} 个参考资料"
	}
	if (outlineCount > 0) {
		return "已整理 {{outlineCount}} 个大纲要点"
	}
	return "已整理 {{materialCount}} 个参考资料"
}

function renderConfirmOutlinePreview(nodes: OutlineNode[], depth = 0): ReactNode {
	if (nodes.length === 0) return null

	return (
		<ul className={cn("space-y-1.5", depth > 0 && "ml-3 border-l border-zinc-200/80 pl-3")}>
			{nodes.map((node) => (
				<li key={node.id} className="space-y-1.5" data-testid="step-confirm-blocks-item">
					<p className="text-xs leading-relaxed text-foreground/80">{node.text}</p>
					{node.children?.length
						? renderConfirmOutlinePreview(node.children, depth + 1)
						: null}
				</li>
			))}
		</ul>
	)
}

function ConfirmOutlinePreview({ nodes }: { nodes: OutlineNode[] }) {
	return renderConfirmOutlinePreview(nodes)
}

function ConfirmBrandFieldRow({
	Icon,
	label,
	value,
}: {
	Icon: LucideIcon
	label: string
	value: string
}) {
	if (!value.trim()) return null

	return (
		<div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 border-b border-zinc-950/10 px-4 py-4 last:border-b-0 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-x-3.5">
			<div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#f4f4f5] text-[#18181b] sm:h-11 sm:w-11">
				<Icon size={18} />
			</div>
			<div className="min-w-0 space-y-1">
				<span className="text-xs font-semibold text-[#71717a]">{label}</span>
				<p className="text-sm font-[760] leading-relaxed text-[#18181b]">{value}</p>
			</div>
		</div>
	)
}

export function ConfirmBrandSummary({
	global,
	t,
}: {
	global: SelfMediaInitData["global"]
	t: StepConfirmTranslate
}) {
	const brandImageCount = global.brandImages?.length ?? 0
	const hasBrandSummary = Boolean(
		global.author.trim() ||
		global.brandPosition.trim() ||
		global.targetAudience.trim() ||
		brandImageCount > 0,
	)

	if (!hasBrandSummary) return null

	return (
		<section className="space-y-3" data-testid="self-media-step-confirm-global-summary">
			<div className="flex items-center gap-2 border-b border-zinc-950/10 pb-2">
				<div className="flex h-8 w-8 items-center justify-center rounded-[14px] bg-[#f4f4f5] text-[#18181b]">
					<Briefcase size={13} />
				</div>
				<h3 className="text-sm font-[820] text-[#18181b]">
					{t("detail.selfMedia.initPanel.stepConfirm.globalSummary", {
						defaultValue: "全局品牌档案",
					})}
				</h3>
			</div>

			<div className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_1px_rgba(255,255,255,0.85),0_14px_34px_rgba(24,24,27,0.06)]">
				<ConfirmBrandFieldRow
					Icon={UserRound}
					label={t("detail.selfMedia.initPanel.stepConfirm.accountLabel", {
						defaultValue: "主创账号",
					})}
					value={global.author}
				/>
				<ConfirmBrandFieldRow
					Icon={Target}
					label={t("detail.selfMedia.initPanel.stepConfirm.positionLabel", {
						defaultValue: "品牌/IP 定位",
					})}
					value={global.brandPosition}
				/>
				<ConfirmBrandFieldRow
					Icon={UsersRound}
					label={t("detail.selfMedia.initPanel.stepConfirm.audienceLabel", {
						defaultValue: "受众定位",
					})}
					value={global.targetAudience}
				/>
				{brandImageCount > 0 ? (
					<ConfirmBrandFieldRow
						Icon={ImageIcon}
						label={t("detail.selfMedia.initPanel.stepBrand.brandImages", {
							defaultValue: "品牌形象素材",
						})}
						value={t("detail.selfMedia.initPanel.stepConfirm.brandAssetCount", {
							count: brandImageCount,
						})}
					/>
				) : null}
			</div>
		</section>
	)
}

export function TopicProgressList({
	topics,
	activeTopicId,
	totalCount,
	isGenerating,
	onSelectTopic,
	t,
}: {
	topics: ArticleBatchTopicItem[]
	activeTopicId: string | null
	totalCount: number
	isGenerating: boolean
	onSelectTopic: (item: ArticleBatchTopicItem) => void
	t: StepConfirmTranslate
}) {
	const hintKey = isGenerating
		? "detail.selfMedia.initPanel.stepConfirm.topicListHint"
		: "detail.selfMedia.initPanel.stepConfirm.completeTopicListHint"
	const activeBadgeKey = isGenerating
		? "detail.selfMedia.initPanel.stepConfirm.viewing"
		: "detail.selfMedia.initPanel.stepConfirm.opened"

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm font-semibold text-[#71717a]">{t(hintKey)}</p>
			<ul className="flex flex-col gap-2.5">
				{topics.map((item) => {
					const isActive = activeTopicId === item.topicId
					return (
						<li key={item.topicId} className="duration-300 animate-in fade-in" data-testid="step-confirm-blocks-item-2">
							<Button
								type="button"
								variant="outline"
								className={cn(
									"h-auto w-full justify-start gap-4 rounded-[24px] border-0 p-4 text-left shadow-[inset_0_1px_rgba(255,255,255,0.85),0_12px_30px_rgba(24,24,27,0.06)] transition-all hover:-translate-y-0.5 hover:bg-white sm:p-5",
									isActive
										? "bg-white ring-1 ring-[#18181b]"
										: "bg-white ring-1 ring-zinc-950/[0.06]",
								)}
								onClick={() => onSelectTopic(item)}
							>
								<span
									className={cn(
										"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-[820] transition-colors duration-300",
										isActive
											? "bg-[#18181b] text-white"
											: "bg-[#f4f4f5] text-[#71717a]",
									)}
								>
									{item.articleIndex + 1}
								</span>
								<div className="min-w-0 flex-1 space-y-0.5">
									<p className="truncate text-base font-[820] text-[#18181b]">
										{item.articleTitle}
									</p>
									<p className="truncate text-sm font-semibold text-[#71717a]">
										{item.topicName}
									</p>
								</div>
								{isActive && (
									<Badge className="shrink-0 rounded-full border-0 bg-[#f4f4f5] px-3 py-1 text-xs font-[800] text-[#18181b] shadow-none">
										{t(activeBadgeKey)}
									</Badge>
								)}
							</Button>
						</li>
					)
				})}
				{isGenerating &&
					Array.from({ length: Math.max(0, totalCount - topics.length) }).map((_, i) => (
						<li
							key={`pending-${i}`}
							className="flex animate-pulse items-center gap-4 rounded-[24px] bg-white px-4 py-3.5 opacity-70 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_12px_30px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/[0.06]"
							data-testid="step-confirm-blocks-item-3"
						>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-sm font-[820] text-[#71717a]">
								{topics.length + i + 1}
							</span>
							<div className="flex-1 space-y-1">
								<span className="text-sm font-semibold text-[#71717a]">
									{t("detail.selfMedia.initPanel.stepConfirm.creatingTopic")}
								</span>
							</div>
							<Loader2 size={16} className="animate-spin text-[#71717a]" />
						</li>
					))}
			</ul>
		</div>
	)
}

export function GenerationCompleteSummary({
	count,
	summaryRef,
	t,
}: {
	count: number
	summaryRef?: Ref<HTMLDivElement>
	t: StepConfirmTranslate
}) {
	return (
		<div
			ref={summaryRef}
			className="flex items-start gap-4 rounded-[28px] bg-white p-5 text-left shadow-[inset_0_1px_rgba(255,255,255,0.85),0_16px_42px_rgba(47,43,36,0.07)]"
			data-testid="self-media-step-confirm-complete-summary"
			role="status"
			tabIndex={-1}
		>
			<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[#18181b] text-[#ffd637] shadow-[0_12px_24px_rgba(24,24,27,0.14)]">
				<CheckCircle size={19} />
			</div>
			<div className="min-w-0 space-y-1">
				<p className="text-base font-[820] text-[#18181b]">
					{t("detail.selfMedia.initPanel.stepConfirm.completeSummaryTitle", {
						count,
					})}
				</p>
				<p className="text-sm font-semibold leading-relaxed text-[#71717a]">
					{t("detail.selfMedia.initPanel.stepConfirm.completeSummaryDesc")}
				</p>
			</div>
		</div>
	)
}

export function StepConfirmHeader({
	articleCount,
	t,
}: {
	articleCount: number
	t: StepConfirmTranslate
}) {
	return (
		<div className="rounded-[28px] bg-white p-5 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_18px_44px_rgba(47,43,36,0.08)] sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0 space-y-2">
					<Badge className="rounded-full border-0 bg-[#f4f4f5] px-3 py-1 text-xs font-[780] text-[#18181b] shadow-none">
						{t("detail.selfMedia.initPanel.stepConfirm.statusReady", "准备生成")}
					</Badge>
					<div className="space-y-1">
						<h2 className="text-2xl font-[820] tracking-normal text-[#18181b] sm:text-3xl">
							{t("detail.selfMedia.initPanel.stepConfirm.title", "确认并生成")}
						</h2>
						<p className="max-w-xl text-sm font-semibold leading-relaxed text-[#71717a]">
							{t(
								"detail.selfMedia.initPanel.stepConfirm.subtitle",
								"确认后会自动创建创作话题，并打开第一篇文章。",
							)}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2 rounded-full bg-[#18181b] px-4 py-2 text-sm font-[800] text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)]">
					<span>{articleCount}</span>
					<span>
						{t("detail.selfMedia.initPanel.stepConfirm.articleUnit", {
							defaultValue: "篇文章",
						})}
					</span>
				</div>
			</div>
		</div>
	)
}

export function StepConfirmArticleList({
	articles,
	getPlatformLabel,
	getStyleLabel,
	t,
}: {
	articles: SelfMediaInitData["articles"]
	getPlatformLabel: (value: string) => string
	getStyleLabel: (value: string) => string
	t: StepConfirmTranslate
}) {
	const hasArticleMaterials = articles.some(
		(article) => collectArticleMaterials(article).length > 0,
	)
	const automationHintKey = hasArticleMaterials
		? "detail.selfMedia.initPanel.stepConfirm.articleListAutomationHint"
		: "detail.selfMedia.initPanel.stepConfirm.articleListAutomationHintWithoutMaterials"
	const automationHintDefaultValue = hasArticleMaterials
		? "开始后会自动拆分话题、上传素材，并打开第一篇。"
		: "开始后会自动拆分话题，并打开第一篇。"

	return (
		<section
			className="rounded-[28px] bg-white p-4 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_16px_42px_rgba(47,43,36,0.07)] sm:p-5"
			data-testid="self-media-step-confirm-article-list"
		>
			<div className="flex flex-col gap-1.5 border-b border-zinc-950/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
				<span className="text-base font-[820] text-[#18181b]">
					{t("detail.selfMedia.initPanel.stepConfirm.articleListTitle", {
						count: articles.length,
					})}
				</span>
				<span className="text-xs font-semibold leading-relaxed text-[#71717a]">
					{t(automationHintKey, {
						defaultValue: automationHintDefaultValue,
					})}
				</span>
			</div>

			<ul className="flex flex-col">
				{articles.map((article, index) => {
					const showCardCount = isCardBasedPlatform(article.platform)
					const materialCount = collectArticleMaterials(article).length
					const outlineCount = countOutlineNodes(article.outline)
					const showArticleReadyHint = outlineCount > 0 || materialCount > 0
					const articleReadyHintKey = getArticleReadyHintKey(outlineCount, materialCount)
					const articleReadyHintDefaultValue = getArticleReadyHintDefaultValue(
						outlineCount,
						materialCount,
					)

					return (
						<li
							key={index}
							className="group flex flex-col gap-3 border-b border-zinc-950/10 px-0 py-4 transition-colors animate-in fade-in last:border-b-0 last:pb-0"
							data-testid="step-confirm-blocks-item-4"
						>
							<div className="flex items-start gap-3">
								<Badge className="h-9 w-9 shrink-0 rounded-[14px] bg-[#18181b] px-0 text-xs font-[820] text-white shadow-none">
									{String(index + 1).padStart(2, "0")}
								</Badge>
								<div className="min-w-0 flex-1 space-y-2">
									<div className="flex items-start gap-2">
										{article.platform ? (
											<PlatformBrandIcon
												platform={article.platform}
												className="mt-0.5 size-3.5 shrink-0"
											/>
										) : null}
										<h4 className="min-w-0 flex-1 text-base font-[820] leading-snug text-[#18181b]">
											{article.title}
										</h4>
									</div>
									<div className="flex flex-wrap gap-1.5">
										{article.platform && (
											<Badge className="rounded-full border-0 bg-[#f4f4f5] px-2.5 py-0.5 text-xs font-[760] text-[#18181b] shadow-none">
												{getPlatformLabel(article.platform)}
											</Badge>
										)}
										{article.style && (
											<Badge className="rounded-full border-0 bg-[#f4f4f5] px-2.5 py-0.5 text-xs font-[760] text-[#18181b] shadow-none">
												{getStyleLabel(article.style)}
											</Badge>
										)}
										{showCardCount && article.cardCount > 0 && (
											<Badge className="rounded-full border-0 bg-white px-2.5 py-0.5 text-xs font-[760] text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.12)]">
												{t(
													"detail.selfMedia.initPanel.stepConfirm.cardCount",
													{ count: article.cardCount },
												)}
											</Badge>
										)}
										{materialCount > 0 && (
											<Badge className="rounded-full border-0 bg-white px-2.5 py-0.5 text-xs font-[760] text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.12)]">
												{t(
													"detail.selfMedia.initPanel.stepConfirm.refCount",
													{
														count: materialCount,
													},
												)}
											</Badge>
										)}
									</div>
									{showArticleReadyHint ? (
										<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
											<CheckCircle size={13} className="shrink-0" />
											<span>
												{t(articleReadyHintKey, {
													outlineCount,
													materialCount,
													defaultValue: articleReadyHintDefaultValue,
												})}
											</span>
										</div>
									) : null}

									{article.outline.length > 0 ? (
										<div className="space-y-1.5 rounded-[18px] bg-[#f8f8f9] p-3">
											<span className="text-xs font-medium text-muted-foreground">
												{t(
													showCardCount
														? "detail.selfMedia.initPanel.stepConfirm.cardOutlineLabel"
														: "detail.selfMedia.initPanel.stepDetail.outlineLabel",
													showCardCount ? "卡片大纲" : "文章大纲",
												)}
											</span>
											<ConfirmOutlinePreview nodes={article.outline} />
										</div>
									) : null}
								</div>
							</div>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
