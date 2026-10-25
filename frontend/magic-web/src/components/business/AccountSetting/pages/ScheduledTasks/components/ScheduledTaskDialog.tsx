import { useRef, type ReactNode } from "react"
import { ConfigProvider } from "antd"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"

interface ScheduledTaskDialogProps {
	open: boolean
	onClose: () => void
	title: string
	children: ReactNode
	records?: boolean
}

export default function ScheduledTaskDialog({
	open,
	onClose,
	title,
	children,
	records = false,
}: ScheduledTaskDialogProps) {
	const contentRef = useRef<HTMLDivElement>(null)
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
		>
			{/* Keep the header visible and reserve room for form actions on short mobile screens. */}
			<DialogContent
				ref={contentRef}
				aria-describedby={undefined}
				className={
					records
						? "max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[700px]"
						: "max-h-[calc(100dvh-2rem)] gap-0 p-0 sm:max-w-[460px]"
				}
			>
				<DialogHeader className="px-5 py-4 pr-12 text-left">
					<DialogTitle className="text-base">{title}</DialogTitle>
				</DialogHeader>
				{/* Legacy form popups must stay inside the Dialog focus and pointer boundary. */}
				<ConfigProvider getPopupContainer={() => contentRef.current ?? document.body}>
					{children}
				</ConfigProvider>
			</DialogContent>
		</Dialog>
	)
}
