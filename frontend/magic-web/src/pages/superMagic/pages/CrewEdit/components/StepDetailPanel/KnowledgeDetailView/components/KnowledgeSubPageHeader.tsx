import { ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"

/**
 * KnowledgeSubPageHeader组件Props
 */
export interface KnowledgeSubPageHeaderProps {
	/** 知识库名称（显示在返回按钮上） */
	knowledgeName: string
	/** 页面标题（如：本地文档、召回测试等） */
	title: string
	/** 返回回调 */
	onBack: () => void
	/** 关闭回调 */
	onClose: () => void
	className?: string
}

/**
 * 知识库子页面通用头部组件
 * 用于创建文档、召回测试等需要返回知识库的子页面
 *
 * @example
 * ```tsx
 * <KnowledgeSubPageHeader
 *   knowledgeName="我的知识库"
 *   title="本地文档"
 *   onBack={handleBack}
 *   onClose={handleClose}
 * />
 * ```
 */
export function KnowledgeSubPageHeader({
	knowledgeName,
	title,
	onBack,
	onClose,
	className,
}: KnowledgeSubPageHeaderProps) {
	return (
		<div className={cn("flex flex-col", className)}>
			<div className="flex items-center justify-between gap-2 pb-3">
				<div className="flex items-center gap-2">
					{/* 左侧：返回按钮 + 知识库名称 */}
					<Button
						variant="outline"
						size="sm"
						onClick={onBack}
						className="gap-2 !px-2 text-foreground"
					>
						<ChevronLeft className="size-4" color="currentColor" />
						{knowledgeName}
					</Button>

					{/* 中间：页面标题 */}
					<h1 className="justify-start text-base font-medium">{title}</h1>
				</div>

				{/* 右侧：关闭按钮 */}
				<Button variant="ghost" size="icon" onClick={onClose} className="h-8">
					<X className="size-6" />
				</Button>
			</div>

			<Separator />
		</div>
	)
}
