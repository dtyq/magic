import { memo, useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { IconBook2, IconChevronDown, IconExternalLink } from "@tabler/icons-react"
import type { CitationSource } from "@/pages/superMagic/utils/citations"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { resolveSafePreviewUrl } from "@/pages/superMagic/components/Detail/components/FilesViewer/components/previewUrl"

interface CitationCardProps {
	/** 引用来源列表 */
	sources: CitationSource[]
	/** 当前高亮的引用序号（null 表示无高亮） */
	highlightedIndex?: number | null
	/** 高亮变更回调 */
	onHighlightChange?: (index: number | null) => void
	/** 知识库文件点击回调 */
	onFileClick?: (citation: CitationSource) => void
	/** 默认展开 */
	defaultExpanded?: boolean
}

function CitationCard({
	sources,
	highlightedIndex = null,
	onHighlightChange,
	onFileClick,
	defaultExpanded = true,
}: CitationCardProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(defaultExpanded)

	const toggleExpanded = useCallback(() => {
		pubsub.publish(PubSubEvents.Message_Suppress_Auto_Scroll)
		setExpanded((v) => !v)
	}, [])

	// 点击引用角标时，如果卡片是收起状态则自动展开
	useEffect(() => {
		if (highlightedIndex != null && !expanded) {
			pubsub.publish(PubSubEvents.Message_Suppress_Auto_Scroll)
			setExpanded(true)
		}
	}, [highlightedIndex])

	if (sources.length === 0) return null

	return (
		<div className="flex flex-col w-full">
			{/* 虚线分隔符 */}
			<div className="border-t border-dashed border-border w-full mb-2" />

			{/* 可折叠 header */}
			<button
				type="button"
				onClick={toggleExpanded}
				className="flex items-center gap-1.5 w-full text-left active:opacity-70 transition-opacity mb-2"
			>
				<IconBook2 size={14} className="text-muted-foreground shrink-0" />
				<span className="flex-1 text-xs leading-4 text-muted-foreground">
					{t("citations.sourceCount", { count: sources.length })}
				</span>
				<IconChevronDown
					size={14}
					className={cn(
						"text-muted-foreground shrink-0 transition-transform duration-200",
						!expanded && "-rotate-90",
					)}
				/>
			</button>

			{/* 展开内容 */}
			{expanded && (
				<ul className="flex flex-col gap-2 m-0 p-0 list-none">
					{sources.map((source) => {
						const isHighlighted = highlightedIndex === source.index
						const safeSourceUrl =
							source.type === "url" && source.url
								? resolveSafePreviewUrl(source.url)
								: null
						return (
							<li key={source.index}>
								<div className="flex items-start gap-2 w-full">
									<button
										type="button"
										onClick={() =>
											onHighlightChange?.(isHighlighted ? null : source.index)
										}
										className="flex items-start gap-2 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
									>
										{/* 圆形序号 */}
										<span
											className={cn(
												"flex-none inline-flex items-center justify-center",
												"w-5 h-5 rounded-full text-[11px] font-semibold leading-none",
												"shrink-0 transition-colors mt-0.5",
												isHighlighted
													? "bg-primary text-primary-foreground"
													: "bg-muted-foreground/15 text-muted-foreground",
											)}
										>
											{source.index}
										</span>

										{/* 标题 + 来源名 */}
										<div className="flex flex-col flex-1 min-w-0 gap-0.5">
											<span
												className={cn(
													"text-[13px] leading-5 font-medium truncate transition-colors",
													isHighlighted
														? "text-primary"
														: "text-foreground",
												)}
											>
												{source.title}
											</span>
											{source.type === "knowledge_base" &&
												source.knowledge_base_name && (
													<span className="text-[11px] leading-4 text-muted-foreground truncate">
														{source.knowledge_base_name}
													</span>
												)}
											{source.type === "url" && safeSourceUrl && (
												<span className="text-[11px] leading-4 text-muted-foreground truncate">
													{new URL(safeSourceUrl).hostname}
												</span>
											)}
										</div>
									</button>

									{/* 打开按钮 */}
									<button
										type="button"
										aria-label={t("citations.openSource")}
										className={cn(
											"shrink-0 flex items-center justify-center",
											"w-6 h-6 rounded-md text-muted-foreground",
											"hover:text-foreground hover:bg-muted-foreground/10",
											"transition-colors mt-0.5 active:opacity-60",
										)}
										onClick={() => handleSourceClick(source)}
									>
										<IconExternalLink size={14} />
									</button>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)

	function handleSourceClick(source: CitationSource) {
		if (source.type === "knowledge_base") {
			onFileClick?.(source)
		} else if (source.type === "url" && source.url) {
			const safeUrl = resolveSafePreviewUrl(source.url)
			if (!safeUrl) return

			window.open(safeUrl, "_blank", "noopener,noreferrer")
		}
	}
}

export default memo(CitationCard)
