import { memo } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import type { SelfMediaPost } from "../types"

interface PostSelectorProps {
	posts: SelfMediaPost[]
	activeIndex: number
	onChange: (index: number) => void
	className?: string
}

/** Compact post switcher used in toolbars. */
function PostSelector({ posts, activeIndex, onChange, className }: PostSelectorProps) {
	const { t } = useTranslation("super")

	if (!posts.length) return null

	return (
		<div
			className={cn("flex min-w-0 items-center gap-2", className)}
			data-testid="self-media-post-selector"
		>
			<Badge variant="secondary" className="rounded-md text-[10px]">
				{t("detail.selfMedia.postSelector.label")}
			</Badge>
			<div className="min-w-0 max-w-full flex-1">
				<Select value={String(activeIndex)} onValueChange={(v) => onChange(Number(v))}>
					<SelectTrigger size="sm" className="h-8 w-fit min-w-0 max-w-full text-xs">
						<span
							className="min-w-0 max-w-full flex-1 truncate text-left"
							data-testid="self-media-post-selector-value"
						>
							<SelectValue />
						</span>
					</SelectTrigger>
					<SelectContent>
						{posts.map((post, idx) => {
							const label =
								post.meta.feedTitle ||
								post.meta.title ||
								t("detail.selfMedia.common.postFallbackTitle", { index: idx + 1 })
							return (
								<SelectItem
									key={post.meta.id || idx}
									value={String(idx)}
									data-testid={`self-media-post-${idx}`}
								>
									<span className="block">{label}</span>
								</SelectItem>
							)
						})}
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}

export default memo(PostSelector)
