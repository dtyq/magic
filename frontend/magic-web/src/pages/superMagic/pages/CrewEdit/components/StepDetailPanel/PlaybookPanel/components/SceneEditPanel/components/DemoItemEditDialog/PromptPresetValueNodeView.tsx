import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { X } from "lucide-react"
import { useCallback, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const PRESET_TOKEN_CLASS_NAME =
	"inline-flex h-5 items-center gap-1 rounded-md border border-foreground-indigo bg-background px-2 align-baseline text-xs font-medium text-foreground-indigo"

export default function PromptPresetValueNodeView({ deleteNode, selected }: ReactNodeViewProps) {
	const { t } = useTranslation("crew/create")
	const tokenLabel = t("playbook.edit.presets.form.presetValue")

	const handleMouseDown = useCallback((event: MouseEvent<HTMLSpanElement>) => {
		event.preventDefault()
	}, [])

	const handleRemove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			event.stopPropagation()
			deleteNode?.()
		},
		[deleteNode],
	)

	return (
		<NodeViewWrapper
			as="span"
			contentEditable={false}
			onMouseDown={handleMouseDown}
			className={cn(
				PRESET_TOKEN_CLASS_NAME,
				"mx-0.5 align-top",
				selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
			)}
		>
			<span>{tokenLabel}</span>
			<button
				type="button"
				onClick={handleRemove}
				className="inline-flex items-center justify-center"
				tabIndex={-1}
				aria-label={tokenLabel}
			>
				<X className="h-3 w-3" />
			</button>
		</NodeViewWrapper>
	)
}
