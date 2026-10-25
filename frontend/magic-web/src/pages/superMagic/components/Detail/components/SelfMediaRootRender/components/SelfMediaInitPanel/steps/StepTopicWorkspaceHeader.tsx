import { ChevronLeft, ChevronRight, FileDown } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import MagicTooltip from "@/components/base/MagicTooltip"
import type { ArticleDetail } from "../types"
import InlineVoiceButton from "../components/ui/InlineVoiceButton"
import { buildDefaultArticleFolderName } from "../../../services/selfMediaPromptBuilder"

interface StepTopicWorkspaceHeaderProps {
	article: ArticleDetail
	activeIndex: number
	articleCount: number
	canPrev: boolean
	canNext: boolean
	focusTitleRequest?: number
	onArticleUpdate: (article: ArticleDetail) => void
	onPrev: () => void
	onNext: () => void
}

function getGeneratedFolderSlug(title: string): string {
	return buildDefaultArticleFolderName(title, 0).replace(/^\d{2}-/, "")
}

function getGeneratedFolderPrefix(folderName: string): string | null {
	return folderName.trim().match(/^(\d{2})-[a-z0-9-]+$/)?.[1] ?? null
}

function isGeneratedFolderName(folderName: string, title: string): boolean {
	const trimmedFolderName = folderName.trim()
	if (!trimmedFolderName) return true
	const titleSlug = getGeneratedFolderSlug(title)
	return new RegExp(`^\\d{2}-${titleSlug}$`).test(trimmedFolderName)
}

export default function StepTopicWorkspaceHeader({
	article,
	activeIndex,
	articleCount,
	canPrev,
	canNext,
	focusTitleRequest = 0,
	onArticleUpdate,
	onPrev,
	onNext,
}: StepTopicWorkspaceHeaderProps) {
	const { t } = useTranslation("super")
	const titleInputRef = useRef<HTMLInputElement>(null)
	const titleInputHintId = useId()
	const folderInputHintId = useId()
	const isAutoFolderName = isGeneratedFolderName(article.folderName, article.title || "")
	const isFolderSynced = isAutoFolderName && Boolean(article.title.trim())
	const folderSyncStatus = isFolderSynced
		? t("detail.selfMedia.initPanel.stepTopic.folderSynced", "已同步目录")
		: t("detail.selfMedia.initPanel.stepTopic.autoFolder", "自动")
	const autoFolderHint = t(
		"detail.selfMedia.initPanel.stepTopic.autoFolderHint",
		"标题会自动生成归档目录，也可以手动修改",
	)
	const manualFolderHint = t(
		"detail.selfMedia.initPanel.stepTopic.manualFolderHint",
		"手动目录会保留，后续标题变更不会覆盖它",
	)
	const titleInputHint = isAutoFolderName
		? t(
				"detail.selfMedia.initPanel.stepTopic.titleInputHint",
				"输入标题后，归档目录会自动同步生成",
			)
		: t(
				"detail.selfMedia.initPanel.stepTopic.titleInputManualFolderHint",
				"目录已手动修改，标题变更不会覆盖它",
			)
	const folderInputHint = isAutoFolderName ? autoFolderHint : manualFolderHint

	const updateTitle = (title: string) => {
		const folderPrefix = getGeneratedFolderPrefix(article.folderName)
		onArticleUpdate({
			...article,
			title,
			folderName: isAutoFolderName
				? folderPrefix
					? `${folderPrefix}-${getGeneratedFolderSlug(title)}`
					: buildDefaultArticleFolderName(title, activeIndex)
				: article.folderName,
		})
	}

	useEffect(() => {
		if (focusTitleRequest <= 0) return
		titleInputRef.current?.focus()
	}, [focusTitleRequest])

	return (
		<div
			data-testid="self-media-topic-workspace-header"
			className="sticky top-0 z-20 flex shrink-0 select-none flex-col gap-3 rounded-[28px] bg-white/95 p-4 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_18px_44px_rgba(47,43,36,0.08)] backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between"
			data-self-media-topic-workspace-header
		>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<div className="mt-0.5 flex h-11 shrink-0 items-center rounded-full bg-[#18181b] px-4 text-sm font-[800] text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)]">
					{activeIndex + 1} / {articleCount}
				</div>

				<div className="min-w-0 flex-1 space-y-2">
					<div className="group relative">
						<Input
							ref={titleInputRef}
							type="text"
							className="h-11 rounded-full border-0 bg-[#f4f4f5] px-4 pr-10 text-sm font-[760] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10"
							placeholder={t(
								"detail.selfMedia.initPanel.stepTopic.titlePlaceholder",
								"点击输入选题标题...",
							)}
							aria-label={t(
								"detail.selfMedia.initPanel.stepTopic.titleInputLabel",
								"选题标题",
							)}
							aria-describedby={titleInputHintId}
							title={titleInputHint}
							value={article.title || ""}
							onChange={(e) => updateTitle(e.target.value)}
						/>
						<span id={titleInputHintId} className="sr-only">
							{titleInputHint}
						</span>
						<InlineVoiceButton value={article.title || ""} onResult={updateTitle} />
					</div>
					<div className="relative">
						<FileDown
							size={13}
							className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#71717a]"
						/>
						<Input
							type="text"
							data-testid="self-media-step-topic-folder-name-input"
							className="h-9 rounded-full border-0 bg-[#f4f4f5] pl-9 pr-20 text-xs font-semibold text-[#71717a] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10"
							placeholder={t(
								"detail.selfMedia.initPanel.stepTopic.folderInputPlaceholder",
								"归档目录",
							)}
							aria-label={
								isAutoFolderName
									? t(
											"detail.selfMedia.initPanel.stepTopic.folderInputAutoLabel",
											"归档目录，当前为自动生成",
										)
									: t(
											"detail.selfMedia.initPanel.stepTopic.folderInputLabel",
											"归档目录",
										)
							}
							aria-describedby={folderInputHintId}
							title={folderInputHint}
							value={article.folderName || ""}
							onChange={(e) =>
								onArticleUpdate({
									...article,
									folderName: e.target.value,
								})
							}
						/>
						<span id={folderInputHintId} className="sr-only">
							{folderInputHint}
						</span>
						{isAutoFolderName ? (
							<span
								aria-live="polite"
								className={cn(
									"absolute right-3 top-1/2 -translate-y-1/2 cursor-help rounded-full px-2 py-0.5 text-[10px] font-[760] transition-colors",
									isFolderSynced
										? "bg-[#f0fdf4] text-[#15803d]"
										: "bg-white/80 text-[#71717a]",
								)}
								title={autoFolderHint}
							>
								{folderSyncStatus}
							</span>
						) : null}
					</div>
				</div>
			</div>

			<div className="flex shrink-0 items-center justify-end gap-1.5">
				<MagicTooltip
					title={t("detail.selfMedia.initPanel.stepTopic.prevArticle", "上一篇")}
				>
					<button
						type="button"
						aria-label={t("detail.selfMedia.initPanel.stepTopic.prevArticle", "上一篇")}
						className={cn(
							"flex h-10 w-10 items-center justify-center rounded-full outline-none transition-all duration-300",
							canPrev
								? "bg-[#f4f4f5] text-[#18181b] hover:bg-[#e4e4e7] active:scale-[0.97]"
								: "cursor-not-allowed bg-[#f4f4f5] text-[#a1a1aa] opacity-50",
						)}
						onClick={onPrev}
						disabled={!canPrev}
						data-testid="on-prev"
					>
						<ChevronLeft size={15} />
					</button>
				</MagicTooltip>
				<MagicTooltip
					title={t("detail.selfMedia.initPanel.stepTopic.nextArticle", "下一篇")}
				>
					<button
						type="button"
						aria-label={t("detail.selfMedia.initPanel.stepTopic.nextArticle", "下一篇")}
						className={cn(
							"flex h-10 w-10 items-center justify-center rounded-full outline-none transition-all duration-300",
							canNext
								? "bg-[#18181b] text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)] hover:-translate-y-0.5"
								: "cursor-not-allowed bg-[#f4f4f5] text-[#a1a1aa] opacity-50",
						)}
						onClick={onNext}
						disabled={!canNext}
						data-testid="on-next"
					>
						<ChevronRight size={15} />
					</button>
				</MagicTooltip>
			</div>
		</div>
	)
}
