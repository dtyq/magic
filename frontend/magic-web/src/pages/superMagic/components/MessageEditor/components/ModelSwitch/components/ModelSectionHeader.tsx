import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"

interface ModelSectionHeaderProps {
	title: string
	testId?: string
}

/**
 * 模型列表的分组标题（企业模型、平台模型）：只有文字、不带图标，
 * 与下方模型行的图标左对齐；弱化的小号标题，桌面列表滚动时吸顶。
 */
export function ModelSectionHeader({ title, testId }: ModelSectionHeaderProps) {
	const isMobile = useIsMobile()

	return (
		<div
			// 打开面板自动滚到选中行时，据此扣除吸顶标题的高度。
			data-model-switch-group-header
			data-testid={testId}
			className={cn(
				"flex items-center px-2 pb-0.5 pt-1.5 text-muted-foreground",
				// 面板与弹层底色都是 card，吸顶时不会露出下面的行。
				!isMobile && "sticky top-0 z-[1] bg-card",
				isMobile && "pt-2.5",
			)}
		>
			<span className="truncate text-xs font-normal leading-4 tracking-[0.01em] [font-family:Inter,sans-serif]">
				{title}
			</span>
		</div>
	)
}
