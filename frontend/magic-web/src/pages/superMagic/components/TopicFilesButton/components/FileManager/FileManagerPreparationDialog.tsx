import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import type { useFileManagerOperations } from "../../hooks/useFileManagerOperations"

/** 准备仅做读取；范围确认由原弹窗接管，关闭准备视图不能取消下一阶段。 */
export function FileManagerPreparationDialog({
	controller,
}: {
	controller: ReturnType<typeof useFileManagerOperations>
}) {
	const { t } = useTranslation("super")
	const cancel = useRef<HTMLButtonElement>(null)
	const state = controller.transferPreparation
	const checking = state?.phase === "checking"
	return (
		<Dialog
			open={checking || state?.phase === "error"}
			onOpenChange={(open) => {
				if (!open) controller.cancelTransfer()
			}}
		>
			<DialogContent
				showCloseButton={false}
				className={
					checking ? "cursor-progress rounded-2xl sm:max-w-md" : "rounded-2xl sm:max-w-md"
				}
				onPointerDownOutside={(event) => event.preventDefault()}
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					cancel.current?.focus()
				}}
				onCloseAutoFocus={(event) => {
					if (controller.transferPreparation || controller.confirmation.state)
						event.preventDefault()
				}}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{checking && <Loader2 size={16} className="animate-spin" />}
						{state?.phase === "error"
							? t("fileManager.preparation.failed")
							: state?.mode === "move"
								? t("fileManager.preparation.checkingMove")
								: t("fileManager.preparation.checkingCopy")}
					</DialogTitle>
					<DialogDescription className="break-words" aria-live="polite">
						{t("fileManager.preparation.target", {
							count: state?.fileIds.length ?? 0,
							target: state?.targetName ?? "",
						})}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					{state?.phase === "error" && (
						<Button
							className="cursor-pointer"
							variant="outline"
							onClick={() => void controller.retryTransfer()}
						>
							{t("userSpace.retry")}
						</Button>
					)}
					<Button
						ref={cancel}
						className="cursor-pointer"
						variant="outline"
						onClick={controller.cancelTransfer}
					>
						{t("common.cancel")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
