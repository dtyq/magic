import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"

interface PcOnlyNoticeDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmText: string
	testIdPrefix: string
}

export default function PcOnlyNoticeDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmText,
	testIdPrefix,
}: PcOnlyNoticeDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				size="sm"
				className="gap-0 p-4"
				data-testid={`${testIdPrefix}-dialog`}
			>
				<AlertDialogHeader className="gap-1.5 pb-3.5">
					<AlertDialogTitle className="text-center font-semibold">
						{title}
					</AlertDialogTitle>
					<AlertDialogDescription className="mx-auto max-w-[18rem] text-center">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="-mx-4 -mb-4 gap-2 border-t bg-muted p-4 group-data-[size=sm]/alert-dialog-content:grid-cols-1 sm:justify-center">
					<AlertDialogAction
						variant="outline"
						size="sm"
						className="w-full"
						data-testid={`${testIdPrefix}-confirm`}
					>
						{confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
