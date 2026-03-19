import { useState } from "react"
import MagicDropdown from "@/components/base/MagicDropdown"
import type { MagicDropdownProps } from "@/components/base/MagicDropdown"
import { cn } from "@/lib/utils"
import { ProjectItemLike, ProjectActionHandlers, ProjectActionMenuKey } from "./types"
import { useProjectActionMenu } from "./useProjectActionMenu"
interface ProjectActionsDropdownProps<T extends ProjectItemLike> extends ProjectActionHandlers<T> {
	item: T
	open?: boolean
	defaultOpen?: boolean
	inCollaborationPanel: boolean
	onOpenChange?: (open: boolean) => void
	/** Called before executing menu action; use for blocking item click propagation */
	onBeforeAction?: () => void
	trigger?: MagicDropdownProps["trigger"]
	placement?: MagicDropdownProps["placement"]
	getPopupContainer?: MagicDropdownProps["getPopupContainer"]
	rootClassName?: string
	overlayClassName?: string
	contextMenuTargetRef?: React.RefObject<HTMLElement | null>
	children:
	| React.ReactNode
	| ((params: {
		open: boolean
		triggerContextMenu: (event: React.MouseEvent<HTMLElement>) => void
	}) => React.ReactNode)
}

function ProjectActionsDropdown<T extends ProjectItemLike>({
	item,
	open,
	defaultOpen = false,
	inCollaborationPanel,
	onOpenChange,
	onBeforeAction,
	onOpenInNewWindow,
	onCopyCollaborationLink,
	onRenameStart,
	onRenameProject,
	onDeleteProject,
	onMoveProject,
	onPinProject,
	onAddCollaborators,
	onAddWorkspaceShortcut,
	onCancelWorkspaceShortcut,
	onShortcutNavigateToWorkspace,
	onTransferProject,
	trigger = ["contextMenu"],
	placement,
	getPopupContainer,
	rootClassName,
	overlayClassName,
	contextMenuTargetRef,
	children,
}: ProjectActionsDropdownProps<T>) {
	const [innerOpen, setInnerOpen] = useState(defaultOpen)
	const isControlledOpen = typeof open === "boolean"
	const mergedOpen = isControlledOpen ? open : innerOpen

	const handleDropdownOpenChange = (nextOpen: boolean) => {
		if (!isControlledOpen) {
			setInnerOpen(nextOpen)
		}
		onOpenChange?.(nextOpen)
	}

	const { contextMenuItems, handleBuiltInAction } = useProjectActionMenu({
		item,
		inCollaborationPanel,
		onRenameStart,
		onRenameProject,
		onDeleteProject,
		onMoveProject,
		onPinProject,
		onAddCollaborators,
		onAddWorkspaceShortcut,
		onCancelWorkspaceShortcut,
		onShortcutNavigateToWorkspace,
		onOpenInNewWindow,
		onCopyCollaborationLink,
		onTransferProject,
	})

	const triggerContextMenu = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation()

		const triggerTarget = contextMenuTargetRef?.current || event.currentTarget
		triggerTarget.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				clientX: event.clientX,
				clientY: event.clientY,
			}),
		)
	}

	const renderedChildren =
		typeof children === "function"
			? children({
				open: mergedOpen,
				triggerContextMenu,
			})
			: children

	return (
		<>
			<MagicDropdown
				open={mergedOpen}
				onOpenChange={handleDropdownOpenChange}
				trigger={trigger}
				placement={placement}
				getPopupContainer={getPopupContainer}
				rootClassName={cn("min-w-0", rootClassName)}
				overlayClassName={cn(
					"w-max min-w-[160px] max-w-[280px]",
					"[&_[data-slot=dropdown-menu-item]]:p-2.5",
					"[&_[data-slot=dropdown-menu-item]]:whitespace-nowrap",
					overlayClassName,
				)}
				menu={{
					items: contextMenuItems,
					onClick: ({ key }) => {
						handleDropdownOpenChange(false)
						onBeforeAction?.()
						const actionKey = key as ProjectActionMenuKey
						handleBuiltInAction(actionKey)
					},
				}}
			>
				{renderedChildren}
			</MagicDropdown>
		</>
	)
}

export default ProjectActionsDropdown
