import { Check, ChevronLeft, ChevronRight, FileDown, Layers, Plus, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import type { ArticleDetail } from "../types"
import PlatformBrandIcon from "../../PlatformBrandIcon"

interface StepTopicArticleNavigatorProps {
	articles: ArticleDetail[]
	activeIndex: number
	collapsed: boolean
	pendingRemoveIndex: number | null
	onCollapsedChange: (collapsed: boolean) => void
	onSelectArticle: (index: number) => void
	onAdd: () => void
	onRequestRemove: (index: number) => void
	onCancelRemove: () => void
	onConfirmRemove: (index: number) => void
}

export default function StepTopicArticleNavigator({
	articles,
	activeIndex,
	collapsed,
	pendingRemoveIndex,
	onCollapsedChange,
	onSelectArticle,
	onAdd,
	onRequestRemove,
	onCancelRemove,
	onConfirmRemove,
}: StepTopicArticleNavigatorProps) {
	const { t } = useTranslation("super")
	const expandNavigatorButtonRef = useRef<HTMLButtonElement>(null)
	const collapseNavigatorButtonRef = useRef<HTMLButtonElement>(null)
	const cancelRemoveButtonRef = useRef<HTMLButtonElement>(null)
	const removeButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	const wasCollapsedRef = useRef(collapsed)
	const [restoreRemoveFocusIndex, setRestoreRemoveFocusIndex] = useState<number | null>(null)

	useEffect(() => {
		if (!collapsed) return
		expandNavigatorButtonRef.current?.focus()
	}, [collapsed])

	useEffect(() => {
		const wasCollapsed = wasCollapsedRef.current
		wasCollapsedRef.current = collapsed
		if (!wasCollapsed || collapsed) return
		const focusTimer = window.setTimeout(() => {
			collapseNavigatorButtonRef.current?.focus()
		}, 0)
		return () => window.clearTimeout(focusTimer)
	}, [collapsed])

	useEffect(() => {
		if (pendingRemoveIndex === null) return
		cancelRemoveButtonRef.current?.focus()
	}, [pendingRemoveIndex])

	useEffect(() => {
		if (pendingRemoveIndex !== null || restoreRemoveFocusIndex === null) return
		removeButtonRefs.current[restoreRemoveFocusIndex]?.focus()
		setRestoreRemoveFocusIndex(null)
	}, [pendingRemoveIndex, restoreRemoveFocusIndex])

	if (collapsed) {
		return (
			<aside
				data-testid="self-media-topic-navigator-panel"
				className="flex h-fit flex-col items-center gap-3 rounded-[24px] bg-white/95 p-3 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_18px_44px_rgba(47,43,36,0.08)]"
				data-self-media-topic-navigator
			>
				<MagicTooltip
					title={t(
						"detail.selfMedia.initPanel.stepTopic.expandNavigator",
						"展开选题看板",
					)}
				>
					<button
						ref={expandNavigatorButtonRef}
						type="button"
						aria-label={t(
							"detail.selfMedia.initPanel.stepTopic.expandNavigator",
							"展开选题看板",
						)}
						className="flex h-9 w-9 items-center justify-center rounded-full bg-[#18181b] text-white transition-transform hover:-translate-y-0.5"
						onClick={() => onCollapsedChange(false)}
						data-testid="on-collapsed-change"
					>
						<ChevronRight size={14} />
					</button>
				</MagicTooltip>
				<div className="flex flex-col items-center gap-2">
					{articles.map((article, idx) => {
						const articleLabel =
							article.title ||
							t("detail.selfMedia.initPanel.stepTopic.topicFallback", {
								index: idx + 1,
								defaultValue: "选题 {{index}}",
							})

						return (
							<MagicTooltip key={idx} title={articleLabel} placement="right">
								<button
									type="button"
									aria-current={idx === activeIndex ? "true" : undefined}
									aria-label={articleLabel}
									title={articleLabel}
									onClick={() => onSelectArticle(idx)}
									className={cn(
										"h-2.5 w-2.5 rounded-full transition-all duration-300",
										idx === activeIndex
											? "scale-125 bg-[#18181b]"
											: "bg-[#d4d4d8] hover:bg-[#a1a1aa]",
									)}
									data-testid="on-select-article"
								/>
							</MagicTooltip>
						)
					})}
				</div>
			</aside>
		)
	}

	return (
		<aside
			data-testid="self-media-topic-navigator-panel"
			className="flex h-fit flex-col rounded-[28px] bg-white/95 p-4 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_20px_60px_rgba(47,43,36,0.08)]"
			data-self-media-topic-navigator
		>
			<div
				className="flex items-center justify-between gap-3 pb-4"
				data-self-media-topic-navigator-header
			>
				<div
					className="flex min-w-0 items-center gap-2 text-[#18181b]"
					data-self-media-topic-navigator-title
				>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5]">
						<Layers size={15} />
					</span>
					<div className="min-w-0">
						<p className="truncate whitespace-nowrap text-sm font-[780]">
							{t("detail.selfMedia.initPanel.stepTopic.navigatorTitle", "选题看板")}
						</p>
						<p className="whitespace-nowrap text-xs font-medium text-[#71717a]">
							{t("detail.selfMedia.initPanel.stepTopic.articleCountLabel", {
								count: articles.length,
								defaultValue: "文章：{{count}} 篇",
							})}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5" data-self-media-topic-actions>
					<MagicTooltip
						title={t(
							"detail.selfMedia.initPanel.stepTopic.collapseNavigator",
							"收起看板",
						)}
					>
						<button
							ref={collapseNavigatorButtonRef}
							type="button"
							aria-label={t(
								"detail.selfMedia.initPanel.stepTopic.collapseNavigator",
								"收起看板",
							)}
							className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f5] text-[#18181b] transition-colors hover:bg-[#e4e4e7]"
							data-self-media-topic-collapse
							onClick={() => onCollapsedChange(true)}
							data-testid="on-collapsed-change-2"
						>
							<ChevronLeft size={14} />
						</button>
					</MagicTooltip>
					<MagicTooltip
						title={t("detail.selfMedia.initPanel.stepTopic.addTopic", "添加选题")}
					>
						<button
							type="button"
							aria-label={t(
								"detail.selfMedia.initPanel.stepTopic.addTopic",
								"添加选题",
							)}
							className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#18181b] px-3 text-xs font-[800] text-white shadow-[0_12px_24px_rgba(24,24,27,0.14)] transition-transform hover:-translate-y-0.5"
							onClick={onAdd}
							data-testid="on-add"
						>
							<Plus size={12} />
							<span className="inline">
								{t("detail.selfMedia.initPanel.stepTopic.addTopic", "添加选题")}
							</span>
						</button>
					</MagicTooltip>
				</div>
			</div>

			{/* Cap the viewport itself so the content-sized panel can shrink for short lists. */}
			{/* A block wrapper keeps long titles from widening Radix's default table wrapper. */}
			<ScrollArea
				className="min-h-0 flex-1"
				viewportClassName="h-auto max-h-[calc(100vh-250px)] pr-1 [&>div]:!block [&>div]:space-y-2"
			>
				{articles.map((item, idx) => {
					const isActive = idx === activeIndex
					const articleLabel =
						item.title ||
						t("detail.selfMedia.initPanel.stepTopic.topicFallback", {
							index: idx + 1,
							defaultValue: "选题 {{index}}",
						})
					const selectLabel = t("detail.selfMedia.initPanel.stepTopic.selectTopicLabel", {
						title: articleLabel,
						defaultValue: "选择{{title}}",
					})
					const handleSelect = () => {
						onCancelRemove()
						onSelectArticle(idx)
					}
					const handleCancelRemove = () => {
						setRestoreRemoveFocusIndex(idx)
						onCancelRemove()
					}
					return (
						<div key={idx} className="group relative w-full">
							<button
								type="button"
								aria-current={isActive ? "true" : undefined}
								aria-label={selectLabel}
								className={cn(
									"relative w-full cursor-pointer rounded-[20px] px-4 py-3 text-left outline-none transition-all duration-300 focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10",
									pendingRemoveIndex === idx
										? "pr-[7.5rem]"
										: isActive
											? "pr-[8.25rem]"
											: "pr-12",
									isActive
										? "bg-[#18181b] text-white shadow-none"
										: "bg-[#f4f4f5] text-[#18181b] hover:bg-[#ededf0]",
								)}
								onClick={handleSelect}
								data-testid="handle-select"
							>
								<div className="flex items-start gap-2.5">
									<span
										className={cn(
											"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-[780]",
											isActive
												? "bg-[#ffd637] text-[#18181b]"
												: "bg-white text-[#18181b]",
										)}
									>
										{idx + 1}
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex min-w-0 items-center gap-1.5">
											{item.platform ? (
												<PlatformBrandIcon
													platform={item.platform}
													className="size-3.5 shrink-0"
												/>
											) : null}
											<p className="min-w-0 flex-1 truncate text-sm font-[760]">
												{item.title ||
													t(
														"detail.selfMedia.initPanel.stepTopic.untitledTopic",
														"未命名选题",
													)}
											</p>
										</div>
										{item.folderName ? (
											<p
												className={cn(
													"mt-1.5 flex items-start gap-1 text-xs font-semibold leading-snug",
													isActive ? "text-white/58" : "text-[#71717a]",
												)}
											>
												<FileDown size={11} className="mt-0.5 shrink-0" />
												<span className="break-words">
													{item.folderName}
												</span>
											</p>
										) : null}
									</div>
								</div>
								{isActive && pendingRemoveIndex !== idx ? (
									<span
										data-testid={`self-media-topic-active-status-${idx}`}
										className="absolute right-12 top-4 flex h-8 items-center rounded-full bg-[#ffd637] px-3 text-[11px] font-[780] text-[#18181b]"
									>
										{t(
											"detail.selfMedia.initPanel.stepTopic.activeTopicStatus",
											"编辑中",
										)}
									</span>
								) : null}
							</button>

							{pendingRemoveIndex === idx ? (
								<div
									className="absolute right-2 top-3 z-10 flex items-center gap-1"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										e.stopPropagation()
										if (e.key === "Escape") {
											handleCancelRemove()
										}
									}}
									data-testid="step-topic-article-navigator"
								>
									<button
										ref={cancelRemoveButtonRef}
										type="button"
										className={cn(
											"flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors",
											isActive
												? "bg-white/16 hover:bg-white/24 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
												: "bg-[#18181b]/6 text-[#18181b] hover:bg-[#18181b]/10",
										)}
										onClick={handleCancelRemove}
										data-testid="handle-cancel-remove"
									>
										<X size={10} />
										<span>
											{t(
												"detail.selfMedia.initPanel.stepTopic.removeCancel",
												"取消",
											)}
										</span>
									</button>
									<button
										type="button"
										className="flex items-center gap-0.5 rounded-full bg-[#ff776c] px-2 py-1 text-[10px] font-semibold text-white transition-transform hover:-translate-y-0.5"
										onClick={() => onConfirmRemove(idx)}
										data-testid="on-confirm-remove"
									>
										<Check size={10} />
										<span>
											{t(
												"detail.selfMedia.initPanel.stepTopic.removeConfirm",
												"删除",
											)}
										</span>
									</button>
								</div>
							) : (
								<button
									type="button"
									ref={(node) => {
										removeButtonRefs.current[idx] = node
									}}
									aria-label={t(
										"detail.selfMedia.initPanel.stepTopic.removeTopicLabel",
										{
											title: articleLabel,
											defaultValue: "删除{{title}}",
										},
									)}
									className={cn(
										"absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full opacity-0 transition-all duration-200 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10 group-hover:opacity-100",
										isActive
											? "hover:bg-white/12 text-white/50 hover:text-white"
											: "text-[#71717a] hover:bg-[#ff776c]/10 hover:text-[#ff776c]",
									)}
									onClick={(e) => {
										e.stopPropagation()
										onRequestRemove(idx)
									}}
									data-testid="on-request-remove"
								>
									<Trash2 size={12} />
								</button>
							)}
						</div>
					)
				})}
			</ScrollArea>
		</aside>
	)
}
