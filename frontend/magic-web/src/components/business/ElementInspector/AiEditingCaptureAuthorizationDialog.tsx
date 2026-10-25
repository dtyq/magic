import { Sparkles } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"

interface AiEditingCaptureAuthorizationDialogProps {
	open: boolean
	title: string
	description: string
	allowText: string
	cancelText: string
	onAllow: () => void
	onCancel: () => void
}

/** Explains why AI editing needs browser capture permission before opening the native picker. */
export function AiEditingCaptureAuthorizationDialog({
	open,
	title,
	description,
	allowText,
	cancelText,
	onAllow,
	onCancel,
}: AiEditingCaptureAuthorizationDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
			<DialogContent
				showCloseButton={false}
				className="w-[calc(100%-24px)] max-w-[420px] gap-5 rounded-2xl p-5"
				data-testid="ai-editing-capture-authorization-dialog"
				data-element-inspector-capture-authorization="true"
			>
				<DialogHeader className="gap-3 text-left">
					<div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Sparkles size={18} />
					</div>
					<div className="space-y-2">
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription className="leading-6">{description}</DialogDescription>
					</div>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel}>
						{cancelText}
					</Button>
					<Button type="button" onClick={onAllow} autoFocus>
						{allowText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
