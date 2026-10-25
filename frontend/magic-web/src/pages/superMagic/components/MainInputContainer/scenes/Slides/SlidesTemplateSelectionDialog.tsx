import type { ReactNode } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import {
	DialogRestoreSizeButton,
	DialogWindowDecorations,
} from "@/pages/superMagic/components/DialogWindow"
import { cn } from "@/utils/cn"
import { useSlidesTemplateWindow } from "./useSlidesTemplateWindow"

interface SlidesTemplateSelectionDialogProps {
	open: boolean
	title: ReactNode
	description?: ReactNode
	onOpenChange: (open: boolean) => void
	children: ReactNode
	footer?: ReactNode
	className?: string
}

/** Shared resizable, draggable dialog shell for every slide-template selection flow. */
export default function SlidesTemplateSelectionDialog({
	open,
	title,
	description,
	onOpenChange,
	children,
	footer,
	className,
}: SlidesTemplateSelectionDialogProps) {
	const { t } = useTranslation("super")
	const windowFrame = useSlidesTemplateWindow(open)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				windowOptions={windowFrame.windowOptions}
				className={cn(
					"flex flex-col gap-0 rounded-xl p-0",
					windowFrame.windowOptions
						? "overflow-visible data-[state=open]:zoom-in-95 motion-reduce:data-[state=open]:animate-none"
						: "h-[760px] max-h-[calc(100vh-32px)] w-[min(90vw,1200px)] !max-w-[1200px] overflow-hidden",
					className,
				)}
				onInteractOutside={(event) => event.preventDefault()}
				data-testid="slides-template-selection-dialog"
			>
				<DialogHeader
					data-dialog-drag-handle
					className={cn(
						"flex-row items-center justify-between gap-4 space-y-0 border-b px-6 py-4 text-left",
						windowFrame.windowOptions?.draggable &&
							"cursor-grab touch-none select-none active:cursor-grabbing",
					)}
					data-testid="slides-template-dialog-header"
				>
					<div className="min-w-0 flex-1">
						<DialogTitle>{title}</DialogTitle>
						{description ? (
							<p className="mt-1 text-sm text-muted-foreground">{description}</p>
						) : null}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<DialogRestoreSizeButton
							frame={windowFrame}
							testId="slides-template-restore-size-button"
						/>
						<DialogClose asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-8 shrink-0 text-muted-foreground"
								aria-label={t("common.close")}
								data-testid="slides-template-dialog-close-button"
							>
								<X className="size-4" aria-hidden="true" />
							</Button>
						</DialogClose>
					</div>
				</DialogHeader>
				{/* Keep reused selector content aligned with the header and inset from dialog edges. */}
				<div className="min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-3 [container-type:inline-size]">
					{children}
				</div>
				{footer ? (
					<DialogFooter className="shrink-0 border-t px-6 py-4 sm:items-center">
						{footer}
					</DialogFooter>
				) : null}
				<DialogWindowDecorations
					frame={windowFrame}
					gripProps={{ testId: "slides-template-resize-grip" }}
					guideProps={{ testId: "slides-template-resize-guide" }}
				/>
			</DialogContent>
		</Dialog>
	)
}
