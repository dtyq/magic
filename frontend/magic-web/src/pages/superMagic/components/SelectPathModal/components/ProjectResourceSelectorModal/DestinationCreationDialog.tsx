import { useId, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"

export interface DestinationCreationOptions {
	title: string
	name: string
	error: string
	loading: boolean
	onChange: (event: ChangeEvent<HTMLInputElement>) => void
	onSubmit: () => void | Promise<void>
	onClose: () => void
}

/** 仅承载原创建 hooks 的输入；创建、重名校验及进入新位置仍由选择器负责。 */
export function DestinationCreationDialog({
	options,
}: {
	options: DestinationCreationOptions | null
}) {
	const { t } = useTranslation("super")
	const errorId = useId()
	if (!options) return null
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !options.loading) options.onClose()
			}}
		>
			<DialogContent
				className="max-w-sm"
				onInteractOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => {
					if (options.loading) event.preventDefault()
				}}
			>
				<DialogHeader>
					<DialogTitle>{options.title}</DialogTitle>
				</DialogHeader>
				<form
					className="flex flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						if (!options.loading) void options.onSubmit()
					}}
				>
					<Input
						value={options.name}
						aria-label={options.title}
						aria-invalid={Boolean(options.error)}
						aria-describedby={options.error ? errorId : undefined}
						disabled={options.loading}
						onChange={options.onChange}
						onFocus={(event) => event.target.select()}
						autoFocus
					/>
					{options.error && (
						<p id={errorId} role="alert" className="text-xs text-destructive">
							{options.error}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={options.loading}
							onClick={options.onClose}
						>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={options.loading || !options.name.trim()}>
							{t("selectPathModal.confirm")}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
