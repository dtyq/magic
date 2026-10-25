import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Paperclip, Plus, X } from "lucide-react"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import type { MaterialItem, OutlineNode } from "../../types"
import MaterialAttachmentList from "../material/MaterialAttachmentList"
import InlineVoiceButton from "../ui/InlineVoiceButton"

interface ArticleOutlineEditorProps {
	outline: OutlineNode[]
	onChange: (outline: OutlineNode[]) => void
	onBlur?: () => void
	uploadToProject?: (file: File, materialId: string) => void
}

let idCounter = 0
function generateId(): string {
	return `outline_${Date.now()}_${++idCounter}`
}

function createEmptyNode(): OutlineNode {
	return { id: generateId(), text: "", children: [], materials: [] }
}

function updateNodeInTree(
	nodes: OutlineNode[],
	id: string,
	updater: (node: OutlineNode) => OutlineNode,
): OutlineNode[] {
	return nodes.map((node) => {
		if (node.id === id) return updater(node)
		if (node.children?.length) {
			return { ...node, children: updateNodeInTree(node.children, id, updater) }
		}
		return node
	})
}

interface OutlineNodeItemProps {
	node: OutlineNode
	depth: number
	expandedAttachmentIds: Set<string>
	onToggleAttachments: (id: string) => void
	onUpdate: (id: string, text: string) => void
	onRemove: (id: string) => void
	onAddChild: (parentId: string) => void
	onAddSibling: (id: string) => void
	onMaterialsChange: (id: string, materials: MaterialItem[]) => void
	onBlur?: () => void
	uploadToProject?: (file: File, materialId: string) => void
}

function OutlineNodeItem({
	node,
	depth,
	expandedAttachmentIds,
	onToggleAttachments,
	onUpdate,
	onRemove,
	onAddChild,
	onAddSibling,
	onMaterialsChange,
	onBlur,
	uploadToProject,
}: OutlineNodeItemProps) {
	const { t } = useTranslation("super")
	const materials = node.materials || []
	const showAttachments = expandedAttachmentIds.has(node.id)

	return (
		<div>
			<div
				className="group flex items-center gap-1.5 rounded-lg border border-transparent py-1 transition-colors hover:border-border hover:bg-accent/40"
				style={{ paddingLeft: `${depth * 20 + 8}px` }}
			>
				<span className="flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-medium text-muted-foreground">
					{node.children && node.children.length > 0 ? "▸" : "•"}
				</span>
				<div className="relative flex-1">
					<Input
						type="text"
						className="h-8 border-0 bg-transparent px-2 pr-7 text-sm shadow-none focus-visible:ring-0"
						placeholder={t(
							"detail.selfMedia.initPanel.stepDetail.outlineNodePlaceholder",
						)}
						value={node.text}
						onChange={(e) => onUpdate(node.id, e.target.value)}
						onBlur={onBlur}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault()
								onAddSibling(node.id)
							} else if (e.key === "Tab") {
								e.preventDefault()
								onAddChild(node.id)
							}
						}}
					/>
					<InlineVoiceButton
						value={node.text}
						onResult={(text) => onUpdate(node.id, text)}
					/>
				</div>
				<div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={cn(
							"relative size-7",
							materials.length > 0 || showAttachments
								? "text-primary"
								: "text-muted-foreground",
						)}
						title={t("detail.selfMedia.initPanel.stepDetail.outlineAttachBtn")}
						onClick={() => onToggleAttachments(node.id)}
					>
						<Paperclip size={14} />
						{materials.length > 0 && (
							<Badge className="absolute -right-1 -top-1 h-3.5 min-w-3.5 rounded-full px-0.5 text-[9px]">
								{materials.length}
							</Badge>
						)}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-7 text-muted-foreground"
						title={t("detail.selfMedia.initPanel.stepDetail.outlineAddChildBtn")}
						onClick={() => onAddChild(node.id)}
					>
						<Plus size={14} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-7 text-muted-foreground hover:text-destructive"
						title={t("detail.selfMedia.initPanel.stepDetail.outlineRemoveBtn")}
						onClick={() => onRemove(node.id)}
					>
						<X size={14} />
					</Button>
				</div>
			</div>

			{showAttachments && (
				<div
					className="mb-1 mt-1 rounded-lg border bg-muted/20 p-2"
					style={{ marginLeft: `${depth * 20 + 20}px` }}
				>
					<MaterialAttachmentList
						compact
						enableProjectPicker
						materials={materials}
						onChange={(next) => onMaterialsChange(node.id, next)}
						uploadToProject={uploadToProject}
						addLabel={t("detail.selfMedia.initPanel.stepDetail.outlineAttachBtn")}
						descriptionPlaceholder={t(
							"detail.selfMedia.initPanel.stepDetail.outlineAttachPlaceholder",
						)}
					/>
				</div>
			)}

			{node.children?.map((child) => (
				<OutlineNodeItem
					key={child.id}
					node={child}
					depth={depth + 1}
					expandedAttachmentIds={expandedAttachmentIds}
					onToggleAttachments={onToggleAttachments}
					onUpdate={onUpdate}
					onRemove={onRemove}
					onAddChild={onAddChild}
					onAddSibling={onAddSibling}
					onMaterialsChange={onMaterialsChange}
					onBlur={onBlur}
					uploadToProject={uploadToProject}
				/>
			))}
		</div>
	)
}

export default function ArticleOutlineEditor({
	outline,
	onChange,
	onBlur,
	uploadToProject,
}: ArticleOutlineEditorProps) {
	const { t } = useTranslation("super")
	const [expandedAttachmentIds, setExpandedAttachmentIds] = useState<Set<string>>(new Set())

	const toggleAttachments = useCallback((id: string) => {
		setExpandedAttachmentIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const updateNode = useCallback(
		(id: string, text: string) => {
			onChange(updateNodeInTree(outline, id, (node) => ({ ...node, text })))
		},
		[outline, onChange],
	)

	const updateMaterials = useCallback(
		(id: string, materials: MaterialItem[]) => {
			onChange(updateNodeInTree(outline, id, (node) => ({ ...node, materials })))
		},
		[outline, onChange],
	)

	const removeNode = useCallback(
		(id: string) => {
			const remove = (nodes: OutlineNode[]): OutlineNode[] =>
				nodes
					.filter((n) => n.id !== id)
					.map((n) => ({
						...n,
						children: n.children ? remove(n.children) : [],
					}))
			onChange(remove(outline))
			setExpandedAttachmentIds((prev) => {
				if (!prev.has(id)) return prev
				const next = new Set(prev)
				next.delete(id)
				return next
			})
		},
		[outline, onChange],
	)

	const addChild = useCallback(
		(parentId: string) => {
			const newNode = createEmptyNode()
			onChange(
				updateNodeInTree(outline, parentId, (node) => ({
					...node,
					children: [...(node.children || []), newNode],
				})),
			)
		},
		[outline, onChange],
	)

	const addSibling = useCallback(
		(id: string) => {
			const newNode = createEmptyNode()
			const insertAfter = (nodes: OutlineNode[]): OutlineNode[] => {
				const result: OutlineNode[] = []
				for (const n of nodes) {
					result.push(n)
					if (n.id === id) {
						result.push(newNode)
					} else if (n.children?.length) {
						const updatedChildren = insertAfter(n.children)
						if (updatedChildren !== n.children) {
							result[result.length - 1] = { ...n, children: updatedChildren }
						}
					}
				}
				return result
			}
			onChange(insertAfter(outline))
		},
		[outline, onChange],
	)

	const handleAddRoot = useCallback(() => {
		onChange([...outline, createEmptyNode()])
	}, [outline, onChange])

	return (
		<div className="pt-1">
			{outline.length === 0 ? (
				<p className="rounded-lg border bg-card py-6 text-center text-sm text-muted-foreground">
					{t("detail.selfMedia.initPanel.stepDetail.outlineEmpty")}
				</p>
			) : (
				<div className="flex flex-col">
					{outline.map((node) => (
						<OutlineNodeItem
							key={node.id}
							node={node}
							depth={0}
							expandedAttachmentIds={expandedAttachmentIds}
							onToggleAttachments={toggleAttachments}
							onUpdate={updateNode}
							onRemove={removeNode}
							onAddChild={addChild}
							onAddSibling={addSibling}
							onMaterialsChange={updateMaterials}
							onBlur={onBlur}
							uploadToProject={uploadToProject}
						/>
					))}
				</div>
			)}
			<Button type="button" variant="outline" className="mt-3 w-full" onClick={handleAddRoot}>
				<Plus size={12} />
				{t("detail.selfMedia.initPanel.stepDetail.outlineAddRootBtn")}
			</Button>
		</div>
	)
}
