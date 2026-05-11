import { KnowledgeSubPageHeader } from "../../KnowledgeSubPageHeader"

/**
 * DocumentCreateHeader组件Props
 */
export interface DocumentCreateHeaderProps {
	/** 知识库名称 */
	knowledgeName: string
	/** 文档类型名称 */
	documentTypeName: string
	/** 返回回调 */
	onBack: () => void
	/** 关闭回调 */
	onClose: () => void
	className?: string
}

/**
 * 文档创建页面头部组件
 * @deprecated 推荐使用 KnowledgeSubPageHeader
 */
export function DocumentCreateHeader({
	knowledgeName,
	documentTypeName,
	onBack,
	onClose,
	className,
}: DocumentCreateHeaderProps) {
	return (
		<KnowledgeSubPageHeader
			knowledgeName={knowledgeName}
			title={documentTypeName}
			onBack={onBack}
			onClose={onClose}
			className={className}
		/>
	)
}
