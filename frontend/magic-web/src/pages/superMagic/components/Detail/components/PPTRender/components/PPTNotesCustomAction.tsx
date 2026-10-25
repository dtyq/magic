import { useState } from "react"
import { PencilLine } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Textarea } from "@/components/shadcn-ui/textarea"

export const MAX_CUSTOM_INSTRUCTION_LENGTH = 500

/** Lets the user describe their own revision request in a floating input. */
export default function PPTNotesCustomAction({
	disabled,
	onSubmit,
}: {
	disabled: boolean
	onSubmit: (instruction: string) => void
}) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [text, setText] = useState("")
	const instruction = text.trim()

	const submit = () => {
		if (!instruction) return
		setOpen(false)
		setText("")
		onSubmit(instruction)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-6 gap-1.5 rounded-md px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
					disabled={disabled}
					data-testid="ppt-notes-custom-trigger"
				>
					<PencilLine className="size-4" />
					{t("ppt.speakerNotes.custom.trigger")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 space-y-2 p-3">
				<Textarea
					autoFocus
					value={text}
					maxLength={MAX_CUSTOM_INSTRUCTION_LENGTH}
					rows={4}
					className="resize-none text-sm"
					placeholder={t("ppt.speakerNotes.custom.placeholder")}
					data-testid="ppt-notes-custom-input"
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault()
							submit()
						}
					}}
				/>
				<div className="flex justify-end">
					<Button
						type="button"
						size="sm"
						className="h-7 px-3 text-xs"
						disabled={!instruction}
						onClick={submit}
					>
						{t("ppt.speakerNotes.custom.submit")}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}
