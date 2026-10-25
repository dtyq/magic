import { ChevronLeft, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import PhoneShell from "../../../PhoneShell"
import type { ArticleDetail, OutlineNode } from "../../types"

interface WechatArticleDraftPreviewProps {
	article: ArticleDetail
}

function renderOutlinePreviewNode(node: OutlineNode, depth: number) {
	const children = node.children || []
	const text = node.text.trim()

	return (
		<div
			key={node.id}
			className={cn(depth === 0 ? "mt-5" : "mt-3 border-l border-[#e8e8e8] pl-3")}
		>
			{text ? (
				<p
					className={cn(
						"m-0 text-[15px] leading-7 text-[#3f3f3f]",
						depth === 0 && "font-semibold text-[#1f1f1f]",
					)}
				>
					{text}
				</p>
			) : null}
			{children.map((child) => renderOutlinePreviewNode(child, depth + 1))}
		</div>
	)
}

export default function WechatArticleDraftPreview({ article }: WechatArticleDraftPreviewProps) {
	const { t } = useTranslation("super")
	const description = article.description?.trim()
	const hasOutline = article.outline.some((node) => node.text.trim() || node.children?.length)

	return (
		<div
			className="flex min-h-[660px] justify-center overflow-hidden rounded-2xl bg-[#f5f6f8] px-4 py-5"
			data-testid="wechat-article-phone-preview"
		>
			<PhoneShell
				width={393}
				height={852}
				scale={0.72}
				theme="dark"
				style={{ transformOrigin: "top center" }}
			>
				<div className="flex h-full w-full flex-col bg-white pt-[54px]">
					<div className="flex h-12 items-center justify-between border-b border-[#f0f0f0] px-3">
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center text-[#1f1f1f]"
							aria-label={t(
								"detail.selfMedia.initPanel.stepDetail.wechatPreviewBack",
								"返回",
							)}
							data-testid="wechat-article-draft-preview-wechat-preview-back-button"
						>
							<ChevronLeft size={24} strokeWidth={2.1} />
						</button>
						<div className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold text-[#1f1f1f]">
							{t(
								"detail.selfMedia.initPanel.stepDetail.wechatPreviewNavTitle",
								"公众号预览",
							)}
						</div>
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center text-[#1f1f1f]"
							aria-label={t(
								"detail.selfMedia.initPanel.stepDetail.wechatPreviewMore",
								"更多",
							)}
							data-testid="wechat-article-draft-preview-wechat-preview-more-button"
						>
							<MoreHorizontal size={23} strokeWidth={2.1} />
						</button>
					</div>

					<article className="flex-1 overflow-y-auto px-6 pb-16 pt-7">
						<h1 className="m-0 text-[24px] font-semibold leading-[1.32] text-[#111]">
							{article.title.trim() ||
								t(
									"detail.selfMedia.initPanel.stepDetail.wechatPreviewUntitled",
									"未命名文章",
								)}
						</h1>
						<div className="mt-4 flex items-center gap-2 text-[13px] text-[#8c8c8c]">
							<span>
								{t(
									"detail.selfMedia.initPanel.stepDetail.wechatPreviewAccount",
									"公众号草稿",
								)}
							</span>
							<span>今天</span>
						</div>

						{description ? (
							<p className="mt-7 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[15px] leading-7 text-[#4a4a4a]">
								{description}
							</p>
						) : null}

						{hasOutline ? (
							<div className="mt-7">
								{article.outline.map((node) => renderOutlinePreviewNode(node, 0))}
							</div>
						) : (
							<p className="mt-10 rounded-xl border border-dashed border-[#d8d8d8] px-4 py-8 text-center text-[14px] leading-6 text-[#999]">
								{t(
									"detail.selfMedia.initPanel.stepDetail.wechatPreviewEmpty",
									"添加全文要点后，这里会同步显示手机阅读预览。",
								)}
							</p>
						)}
					</article>
				</div>
			</PhoneShell>
		</div>
	)
}
