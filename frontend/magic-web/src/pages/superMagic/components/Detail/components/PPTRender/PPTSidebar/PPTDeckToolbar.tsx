import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckSquare, MoreHorizontal, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import type { PPTDeckTools } from "../hooks/usePPTDeckTools"
import { cn } from "@/utils/cn"

export default function PPTDeckToolbar({
	onOpenTransitions,
	tools,
	allowEdit,
	slideCount,
	isMobile,
}: {
	onOpenTransitions?: () => void
	tools: PPTDeckTools
	allowEdit: boolean
	slideCount: number
	isMobile: boolean
}) {
	const { t } = useTranslation("super")
	const [removeTargets, setRemoveTargets] = useState<ReadonlySet<string> | null>(null)
	const [removing, setRemoving] = useState(false)
	const removingRef = useRef(false)
	const confirmRemove = async () => {
		if (!removeTargets || removingRef.current) return
		// Include the unsaved-edit prompt in the lock, before tools.busy becomes true.
		removingRef.current = true
		setRemoving(true)
		try {
			await tools.remove(removeTargets)
			setRemoveTargets(null)
		} finally {
			removingRef.current = false
			setRemoving(false)
		}
	}
	const selectedCount = tools.selected.size
	const actionsDisabled = !selectedCount || tools.busy
	const [actionsOpen, setActionsOpen] = useState(false)
	useEffect(() => {
		// Do not reopen a stale menu when selection or editing becomes available again.
		if (actionsDisabled || !tools.selecting || !allowEdit) setActionsOpen(false)
	}, [actionsDisabled, tools.selecting, allowEdit])
	const selectAllId = useId()
	return (
		<div
			className={cn(
				"shrink-0 space-y-1 border-border px-2 py-1",
				isMobile ? "w-36 border-r" : "border-b",
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-1">
				<Button
					className="h-6 gap-1 px-1.5 text-xs"
					size="sm"
					variant={tools.selecting ? "secondary" : "ghost"}
					aria-pressed={tools.selecting}
					disabled={tools.busy}
					onClick={() =>
						tools.selecting ? tools.clearSelection() : tools.setSelecting(true)
					}
				>
					<CheckSquare className="size-4" />
					{t("ppt.batch.select")}
				</Button>
				{tools.selecting && allowEdit ? (
					<DropdownMenu
						open={actionsOpen && !actionsDisabled}
						onOpenChange={(open) => setActionsOpen(open && !actionsDisabled)}
					>
						<DropdownMenuTrigger asChild disabled={actionsDisabled}>
							<Button
								size="sm"
								variant="ghost"
								className="h-6 gap-1 px-1.5 text-xs"
								disabled={actionsDisabled}
							>
								<MoreHorizontal className="size-4" />
								{t("ppt.batch.actions")}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onOpenTransitions && (
								<DropdownMenuItem onSelect={onOpenTransitions}>
									{t("ppt.transitions.title")}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onSelect={() => void tools.duplicate()}>
								{t("ppt.batch.copy")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void tools.setHidden(true)}>
								{t("ppt.batch.hide")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void tools.setHidden(false)}>
								{t("ppt.batch.show")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => void tools.move(0)}>
								{t("ppt.batch.moveFirst")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void tools.move(slideCount)}>
								{t("ppt.batch.moveLast")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive"
								disabled={selectedCount >= slideCount}
								onSelect={() => setRemoveTargets(new Set(tools.selected))}
							>
								{t("ppt.batch.remove")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
			{tools.selecting ? (
				<div className="flex items-center justify-between gap-1">
					<p className="min-w-0 text-xs text-muted-foreground" role="status">
						{t("ppt.batch.selectedCount", { count: selectedCount })}
					</p>
					<div className="flex h-6 shrink-0 items-center gap-1.5 px-1.5">
						<Checkbox
							id={selectAllId}
							checked={
								tools.isAllSelected
									? true
									: selectedCount > 0
										? "indeterminate"
										: false
							}
							disabled={tools.busy}
							onCheckedChange={
								tools.isAllSelected ? tools.deselectAll : tools.selectAll
							}
						/>
						<label
							htmlFor={selectAllId}
							className="cursor-pointer text-xs peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
						>
							{tools.isAllSelected ? t("ppt.deselectAll") : t("ppt.batch.selectAll")}
						</label>
					</div>
				</div>
			) : null}
			{tools.busy ? (
				<Button
					variant="outline"
					size="sm"
					className="h-6 w-full text-xs"
					onClick={tools.cancel}
				>
					<Loader2 className="mr-1 size-4 animate-spin" />
					{t("ppt.batch.stop")}
				</Button>
			) : null}
			<Dialog
				open={removeTargets !== null}
				onOpenChange={(open) => {
					if (!open && !removingRef.current) setRemoveTargets(null)
				}}
			>
				<DialogContent showCloseButton={!removing}>
					<DialogHeader>
						<DialogTitle>
							{t("ppt.batch.removeTitle", { count: removeTargets?.size || 0 })}
						</DialogTitle>
						<DialogDescription>{t("ppt.batch.removeDescription")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={removing}
							onClick={() => setRemoveTargets(null)}
						>
							{t("ppt.batch.cancel")}
						</Button>
						<Button
							variant="destructive"
							disabled={removing || tools.busy || !allowEdit || !removeTargets?.size}
							aria-busy={removing}
							onClick={confirmRemove}
						>
							{removing && (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							)}
							{t("ppt.batch.remove")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
