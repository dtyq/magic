import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import { DocumentCreateHeader } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/DocumentCreate/components/DocumentCreateHeader"
import { StepIndicator } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/DocumentCreate/components/StepIndicator"
import type { Step } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/components/DocumentCreate/components/StepIndicator/types"

/**
 * DocumentCreateLayout组件Props
 */
export interface DocumentCreateLayoutProps {
	/** 知识库名称 */
	knowledgeName: string
	/** 文档类型名称 */
	documentTypeName: string
	/** 当前步骤 */
	currentStep: number
	/** 步骤配置列表 */
	steps: Step[]
	/** 返回回调 */
	onBack: () => void
	/** 关闭回调 */
	onClose: () => void
	/** 子内容 */
	children: React.ReactNode
	className?: string
}

/**
 * 文档创建页面布局组件
 * 提供统一的页面结构：头部 + 步骤指示器 + 内容区域
 */
export const DocumentCreateLayout = observer(function DocumentCreateLayout({
	knowledgeName,
	documentTypeName,
	currentStep,
	steps,
	onBack,
	onClose,
	children,
	className,
}: DocumentCreateLayoutProps) {
	return (
		<div className={cn("flex h-full flex-col gap-8 bg-background", className)}>
			{/* 头部导航 */}
			<DocumentCreateHeader
				knowledgeName={knowledgeName}
				documentTypeName={documentTypeName}
				onBack={onBack}
				onClose={onClose}
			/>

			{/* 步骤指示器 */}
			<StepIndicator steps={steps} />

			{/* 内容区域 */}
			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	)
})
