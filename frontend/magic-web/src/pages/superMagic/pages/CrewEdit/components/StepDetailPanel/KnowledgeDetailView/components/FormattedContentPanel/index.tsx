import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { DocumentTree } from "../../utils/DocumentTree"
import ContentNodeComponent from "./ContentNode"
import type { ContentNode } from "../../types/content-node"
import { useTranslation } from "react-i18next"

interface FormattedContentPanelProps {
	/** 文档节点数据 */
	documentNodes: ContentNode[]
}

/**
 * 格式化内容面板
 * 纯展示组件，只负责渲染文档节点树结构
 * 数据由父组件传入，不在组件内部请求
 */
function FormattedContentPanel({ documentNodes }: FormattedContentPanelProps) {
	const { t } = useTranslation("crew/create")

	if (documentNodes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("documentCreate.preview.emptyContent")}
			</div>
		)
	}

	const tree = new DocumentTree(documentNodes)
	const root = tree.getRoot()

	if (!root) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("documentCreate.preview.parseError")}
			</div>
		)
	}

	// 递归渲染节点
	const renderNode = (node: ContentNode, depth: number): JSX.Element => {
		const children = tree.getChildren(node.id)
		return (
			<div key={node.id}>
				<ContentNodeComponent node={node} depth={depth} />
				{children.map((child) => renderNode(child, depth + 1))}
			</div>
		)
	}

	return (
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className="p-6">{renderNode(root, 0)}</div>
		</ScrollArea>
	)
}

export default FormattedContentPanel
