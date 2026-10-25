import { Check, ChevronRight, Link2 } from "lucide-react"
import { useCallback, useState } from "react"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import ReferenceMediaPreview from "../../../previews/reference-media/index"
import type { LinkedEditorMediaItem } from "../../../editors/connection/linkedEditorInputs"
import type { LinkedFrameBinding } from "./video-editor-config.types"
import { getLinkedMediaReferenceIdentity } from "../../../editors/connection/linkedEditorInputs"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/shadcn/popover"

export type LinkedFrameRole = "start" | "end"

interface LinkedFrameMediaMenuProps {
	items: Array<LinkedEditorMediaItem & { kind: "image"; path: string }>
	bindings: Array<LinkedFrameBinding | undefined>
	slotIndex: number
	frameRole: LinkedFrameRole
	resolveResourceReference?: ResolveCanvasResourceReference
	onSelect: (item: LinkedEditorMediaItem & { kind: "image"; path: string }) => void
	onClear: () => void
}

function isItemBoundToSlot(
	item: LinkedEditorMediaItem & { kind: "image"; path: string },
	binding: LinkedFrameBinding | undefined,
	resolveResourceReference?: ResolveCanvasResourceReference,
) {
	return (
		binding?.sourceConnectionId === item.connectionId &&
		getLinkedMediaReferenceIdentity(binding.sourcePath, resolveResourceReference) ===
			getLinkedMediaReferenceIdentity(item.path, resolveResourceReference)
	)
}

/** 首尾帧槽位 Popover 中的连线图片直接选择列表。 */
export default function LinkedFrameMediaMenu(props: LinkedFrameMediaMenuProps) {
	const { items, bindings, slotIndex, frameRole, resolveResourceReference, onSelect, onClear } =
		props
	const { t } = useCanvasDesignI18n()
	const [open, setOpen] = useState(false)
	const title = t("videoEditor.linkedFrameMedia", "关联媒体")
	const clearLabel = t("videoEditor.clearLinkedFrame", "清除当前槽位关联")
	const assignLabel =
		frameRole === "start"
			? t("videoEditor.useAsStartFrame", "设为首帧")
			: t("videoEditor.useAsEndFrame", "设为尾帧")
	const handleSelect = useCallback(
		(item: LinkedEditorMediaItem & { kind: "image"; path: string }) => {
			setOpen(false)
			onSelect(item)
		},
		[onSelect],
	)
	const handleClear = useCallback(() => {
		setOpen(false)
		onClear()
	}, [onClear])
	if (items.length === 0) return null

	return (
		<div className="mb-1 w-full border-b border-border pb-1" data-linked-frame-submenu-trigger>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-normal text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
						aria-haspopup="menu"
						aria-expanded={open}
						onMouseEnter={() => setOpen(true)}
					>
						<Link2
							size={16}
							className="shrink-0 text-foreground"
							aria-hidden
							strokeWidth={2.5}
						/>
						<span className="min-w-0 flex-1">{title}</span>
						<ChevronRight
							size={16}
							className="shrink-0 text-muted-foreground"
							aria-hidden
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent
					data-linked-frame-submenu
					align="start"
					side="right"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
					className="!w-[280px] !p-1"
				>
					<div className="max-h-[280px] overflow-y-auto">
						{items.map((item) => {
							const selected = isItemBoundToSlot(
								item,
								bindings[slotIndex],
								resolveResourceReference,
							)
							const assignedRoles = bindings.flatMap((binding) => {
								if (
									!binding ||
									!isItemBoundToSlot(item, binding, resolveResourceReference)
								) {
									return []
								}
								return [binding.frameRole]
							})
							const statusLabel = assignedRoles.length
								? assignedRoles
										.map((role) =>
											role === "start"
												? t("videoEditor.slotLabelFirstFrame", "首帧")
												: t("videoEditor.slotLabelLastFrame", "尾帧"),
										)
										.join(" · ")
								: undefined
							const name = item.fileName || item.path
							return (
								<button
									key={`${item.connectionId}-${item.path}`}
									type="button"
									className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-popover-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
									aria-pressed={selected}
									title={selected ? clearLabel : assignLabel}
									onClick={() => (selected ? handleClear() : handleSelect(item))}
								>
									<span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
										<ReferenceMediaPreview
											path={item.path}
											fileName={name}
											mediaType="image"
											fillParent
											objectFit="contain"
											inlineOriginal
											enableTooltip={false}
										/>
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate" title={name}>
											{name}
										</span>
										{statusLabel ? (
											<span className="block truncate text-xs text-muted-foreground">
												{statusLabel}
											</span>
										) : null}
									</span>
									<span className="flex h-4 w-4 shrink-0 items-center justify-center">
										{selected ? <Check size={14} aria-hidden /> : null}
									</span>
								</button>
							)
						})}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}
