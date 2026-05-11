import { Button } from "@/components/shadcn-ui/button"
import {
	Drawer,
	DrawerDescription,
	DrawerHeader,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
} from "@/components/shadcn-ui/drawer"
import { Input as ShadcnInput } from "@/components/shadcn-ui/input"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { memo, useEffect, useRef } from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import type { RenameModalProps } from "./types"

function RenameModal({
	visible,
	currentActionItem,
	onCancel,
	onOk,
	onInputChange,
	translations,
}: RenameModalProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	const getTitle = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.workspaceRename
			case "project":
				return translations.projectRename
			case "topic":
				return translations.topicRename
			default:
				return ""
		}
	}

	const getPlaceholder = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.inputWorkspaceName
			case "project":
				return translations.inputProjectName
			case "topic":
				return translations.inputTopicName
			default:
				return ""
		}
	}

	const getValue = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return currentActionItem?.workspace?.name
			case "project":
				return currentActionItem?.project?.project_name
			case "topic":
				return currentActionItem?.topic?.topic_name
			default:
				return ""
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && getValue()?.trim()) {
			onOk()
		}
	}

	useEffect(() => {
		if (visible) {
			setTimeout(() => {
				inputRef.current?.focus()
			}, 0)
		}
	}, [visible])

	const renderInputContent = () => (
		<ShadcnInput
			ref={inputRef}
			className="bg-white"
			value={getValue()}
			onChange={(e) => onInputChange(e.target.value)}
			onKeyDown={handleKeyDown}
			placeholder={getPlaceholder()}
			autoFocus
		/>
	)

	return (
		<Drawer
			open={visible}
			onOpenChange={(open) => !open && onCancel()}
			repositionInputs={false}
		>
			<DrawerPortal data-slot="drawer-portal">
				<DrawerOverlay className="z-drawer bg-[rgba(22,22,26,0.6)]" />
				<DrawerPrimitive.Content
					data-slot="drawer-content"
					className={cn(
						"group/drawer-content fixed z-drawer flex h-auto flex-col bg-background",
						"data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80dvh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
						"data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80dvh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
						"data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
						"data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
						"[&[data-vaul-drawer-direction]>div:first-child]:!hidden",
						"z-drawer mx-[14px] mb-[34px] flex max-h-[85dvh] flex-col overflow-hidden rounded-[14px] border-border bg-secondary",
						"shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]",
						"after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0",
						"after:h-[calc(env(safe-area-inset-bottom)+34px)] after:translate-y-full",
					)}
				>
					<div className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
					<DrawerHeader className="h-11 shrink-0 flex-row items-center justify-between gap-1.5 px-3 py-0">
						<DrawerTitle className="flex-1 truncate text-left text-sm font-medium leading-none text-foreground">
							{getTitle()}
						</DrawerTitle>
						<DrawerDescription className="sr-only">{getTitle()}</DrawerDescription>
						<Button
							variant="ghost"
							size="icon-sm"
							className="shrink-0"
							onClick={onCancel}
						>
							<XIcon className="size-4" />
							<span className="sr-only">{translations.cancel}</span>
						</Button>
					</DrawerHeader>
					<div className="scrollbar-y-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
						<div className="flex flex-col gap-2.5">
							<div className="text-xs font-normal leading-4 text-foreground">
								{translations.newName}
							</div>
							{renderInputContent()}
						</div>
						<div className="flex gap-1.5 pt-1">
							<Button
								variant="outline"
								className="h-9 shrink-0 rounded-lg px-8"
								onClick={onCancel}
							>
								{translations.cancel}
							</Button>
							<Button
								className="h-9 flex-1 rounded-lg"
								onClick={onOk}
								disabled={!getValue()?.trim()}
							>
								{translations.confirm}
							</Button>
						</div>
					</div>
				</DrawerPrimitive.Content>
			</DrawerPortal>
		</Drawer>
	)
}

export default memo(RenameModal)
