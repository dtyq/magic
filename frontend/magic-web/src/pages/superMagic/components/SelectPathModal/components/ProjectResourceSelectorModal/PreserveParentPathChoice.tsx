import { useMemo, useState } from "react"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"

import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { getItemName } from "../../utils/attachmentUtils"

interface PreviewNode {
	item: AttachmentItem
	children: PreviewNode[]
}

interface PreserveParentPathChoiceProps {
	fileIds: string[]
	attachmentById: Map<string, AttachmentItem>
	onChange: (value: boolean) => void
	labels: Record<
		"examples" | "keepDescription" | "flatDescription" | "keepTitle" | "flatTitle",
		string
	>
}

function isVirtualRoot(item: AttachmentItem) {
	const name = getItemName(item)
	return item.is_directory && (name === "" || name === "/" || item.file_type === "root")
}

/** Keep only selected files and their real directory ancestors. */
function buildPreview(fileIds: string[], attachmentById: Map<string, AttachmentItem>) {
	const includedIds = new Set<string>()
	for (const fileId of fileIds) {
		let current = attachmentById.get(fileId)
		const visited = new Set<string>()
		while (current?.file_id && !visited.has(current.file_id) && !isVirtualRoot(current)) {
			visited.add(current.file_id)
			includedIds.add(current.file_id)
			const parent = current.parent_id
				? attachmentById.get(String(current.parent_id))
				: undefined
			current = parent?.is_directory ? parent : undefined
		}
	}

	const nodes = new Map<string, PreviewNode>()
	for (const id of includedIds) {
		const item = attachmentById.get(id)
		if (item) nodes.set(id, { item, children: [] })
	}
	const preserved: PreviewNode[] = []
	for (const node of nodes.values()) {
		const parent = node.item.parent_id ? nodes.get(String(node.item.parent_id)) : undefined
		if (parent) parent.children.push(node)
		else preserved.push(node)
	}

	return {
		preserved,
		flat: fileIds.flatMap((id) => {
			const item = attachmentById.get(id)
			return item ? [{ item, children: [] }] : []
		}),
	}
}

function PreviewTree({ nodes, depth = 0 }: { nodes: PreviewNode[]; depth?: number }) {
	return (
		<div className="py-0.5">
			{nodes.map((node) => {
				const name = getItemName(node.item)
				return (
					<div key={node.item.file_id || `${depth}-${name}`}>
						<div
							className="flex h-7 min-w-0 items-center gap-1 rounded px-1 text-xs text-foreground"
							style={{ paddingLeft: depth * 16 + 4 }}
						>
							{node.item.is_directory ? (
								<IconChevronDown
									size={14}
									className="shrink-0 text-muted-foreground"
								/>
							) : (
								<span className="w-3.5 shrink-0" />
							)}
							<FileResourceIcon
								presentation={resolveFilePresentation(node.item)}
								size={16}
								className="shrink-0"
							/>
							<span className="min-w-0 truncate" title={name}>
								{name}
							</span>
						</div>
						{node.children.length > 0 && (
							<PreviewTree nodes={node.children} depth={depth + 1} />
						)}
					</div>
				)
			})}
		</div>
	)
}

export function PreserveParentPathChoice({
	fileIds,
	attachmentById,
	onChange,
	labels,
}: PreserveParentPathChoiceProps) {
	const [preserve, setPreserve] = useState(false)
	const preview = useMemo(() => buildPreview(fileIds, attachmentById), [fileIds, attachmentById])
	const select = (value: boolean) => {
		setPreserve(value)
		onChange(value)
	}
	const cardClass = (active: boolean) =>
		cn(
			"min-w-0 cursor-pointer rounded-lg border p-2.5 transition-colors",
			active ? "border-primary bg-primary/5" : "border-border bg-muted/30",
		)

	return (
		<div className="flex flex-col gap-3">
			<div className="text-sm leading-5 text-muted-foreground">
				{preserve ? labels.keepDescription : labels.flatDescription}
			</div>
			<div className="grid grid-cols-2 gap-2" aria-label={labels.examples} role="radiogroup">
				{[
					{ value: true, title: labels.keepTitle, nodes: preview.preserved },
					{ value: false, title: labels.flatTitle, nodes: preview.flat },
				].map((option) => {
					const active = preserve === option.value
					return (
						<div
							key={String(option.value)}
							className={cardClass(active)}
							onClick={() => select(option.value)}
							role="radio"
							aria-checked={active}
							tabIndex={0}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") select(option.value)
							}}
						>
							<div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-foreground">
								<span>{option.title}</span>
								{active && (
									<IconCheck size={14} className="shrink-0 text-primary" />
								)}
							</div>
							<ScrollArea className="h-48 min-h-0" viewportClassName="[&>div]:!block">
								<PreviewTree nodes={option.nodes} />
							</ScrollArea>
						</div>
					)
				})}
			</div>
		</div>
	)
}
