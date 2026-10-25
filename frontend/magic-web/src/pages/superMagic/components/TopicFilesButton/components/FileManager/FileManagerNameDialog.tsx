import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import InputWithError from "../InputWithError"
import type { useFileManagerNames } from "../../hooks/useFileManagerNames"

export function FileManagerNameDialog({
	names,
}: {
	names: ReturnType<typeof useFileManagerNames>
}) {
	const { t } = useTranslation("super")
	const { input, pending } = names
	return (
		<Dialog
			open={Boolean(input)}
			onOpenChange={(open) => {
				if (!open && !pending) input?.cancel()
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{input?.title}</DialogTitle>
					<DialogDescription className="break-words">
						{t("fileManager.confirmation.location")} {names.location}
					</DialogDescription>
				</DialogHeader>
				{input && (
					<InputWithError
						ref={input.inputRef}
						value={input.value}
						disabled={pending}
						onChange={(event) => input.setValue(event.target.value)}
						errorMessage={input.error}
						showError={Boolean(input.error)}
						onKeyDown={(event) => {
							if (
								event.key === "Enter" &&
								!event.nativeEvent.isComposing &&
								!pending
							) {
								event.preventDefault()
								void input.confirm()
							}
						}}
					/>
				)}
				<DialogFooter>
					<Button variant="outline" disabled={pending} onClick={() => input?.cancel()}>
						{t("common.cancel")}
					</Button>
					<Button disabled={pending} onClick={() => void input?.confirm()}>
						{t("common.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
