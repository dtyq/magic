import { MicOff, Settings, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"

interface MicrophonePermissionDialogProps {
	open: boolean
	title: string
	description: string
	instructions: string
	confirmText: string
	cancelText: string
	onConfirm: () => void
	onClose: () => void
}

export function MicrophonePermissionDialog({
	open,
	title,
	description,
	instructions,
	confirmText,
	cancelText,
	onConfirm,
	onClose,
}: MicrophonePermissionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="w-[calc(100%-24px)] max-w-[420px] gap-0 overflow-hidden rounded-[16px] border border-border bg-background p-0 shadow-[0px_16px_40px_rgba(0,0,0,0.12)]"
				data-testid="microphone-permission-dialog"
			>
				<div
					className="flex items-start gap-3 border-b border-border px-4 py-4"
					data-testid="microphone-permission-dialog-header"
				>
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<MicOff size={18} />
					</div>
					<div className="min-w-0 flex-1">
						<DialogTitle
							className="text-base font-medium leading-6 text-foreground"
							data-testid="microphone-permission-dialog-title"
						>
							{title}
						</DialogTitle>
						<DialogDescription
							className="mt-1 text-sm leading-5 text-muted-foreground"
							data-testid="microphone-permission-dialog-description"
						>
							{description}
						</DialogDescription>
					</div>
					<button
						type="button"
						className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						onClick={onClose}
						data-testid="microphone-permission-dialog-close-button"
					>
						<X size={16} />
					</button>
				</div>

				<div
					className="flex flex-col gap-3 px-4 py-4"
					data-testid="microphone-permission-dialog-content"
				>
					<div className="rounded-[12px] bg-secondary p-3">
						<div className="flex items-center gap-2">
							<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
								<Settings size={14} />
							</div>
							<p
								className="text-sm leading-5 text-foreground"
								data-testid="microphone-permission-dialog-instructions"
							>
								{instructions}
							</p>
						</div>
					</div>
				</div>

				<div
					className="flex gap-2 border-t border-border bg-secondary/40 p-3"
					data-testid="microphone-permission-dialog-actions"
				>
					<Button
						type="button"
						variant="outline"
						className="h-9 flex-1 bg-background text-sm font-medium text-foreground"
						onClick={onClose}
						data-testid="microphone-permission-dialog-cancel-button"
					>
						{cancelText}
					</Button>
					<Button
						type="button"
						className="h-9 flex-1 text-sm font-medium"
						onClick={onConfirm}
						data-testid="microphone-permission-dialog-confirm-button"
					>
						{confirmText}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default MicrophonePermissionDialog
