import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import {
	DEFAULT_LOCALE_KEY,
	type LocaleText,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { normalizeLocaleText, setLocaleValue } from "../LocaleTextInput"
import { PromptRichTextEditor, type PromptRichTextEditorHandle } from "./PromptRichTextEditor"
import { PromptRichTextLocaleDialog } from "./PromptRichTextLocaleDialog"
import { usePromptMentionDataService } from "./usePromptMentionDataService"

interface PromptRichTextLocaleEditorProps {
	value: LocaleText
	onChange: (value: LocaleText) => void
	placeholder?: string
	localizeLabel?: string
	className?: string
	"data-testid"?: string
	error?: string
}

function getDefaultLocaleValue(text: LocaleText): string {
	if (typeof text === "string") return text
	return normalizeLocaleText(text)[DEFAULT_LOCALE_KEY]
}

export function PromptRichTextLocaleEditor({
	value,
	onChange,
	placeholder,
	localizeLabel,
	className,
	"data-testid": testId,
	error,
}: PromptRichTextLocaleEditorProps) {
	const { t } = useTranslation("crew/create")
	const editorRef = useRef<PromptRichTextEditorHandle | null>(null)
	const mentionDataService = usePromptMentionDataService()
	const defaultValue = getDefaultLocaleValue(value)

	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex items-center justify-end gap-1.5">
				<Button
					type="button"
					variant="outline"
					className="h-9 gap-2 px-3 text-xs font-medium text-foreground shadow-xs"
					onClick={() => editorRef.current?.insertPresetValue()}
					data-testid={testId ? `${testId}-insert-preset-value-btn` : undefined}
				>
					<CirclePlus className="h-4 w-4" />
					{t("playbook.edit.presets.form.insertPresetValue")}
				</Button>
				<PromptRichTextLocaleDialog
					value={value}
					onChange={onChange}
					placeholder={placeholder}
					localizeLabel={localizeLabel}
					mentionDataService={mentionDataService}
					data-testid={testId}
				/>
			</div>
			<PromptRichTextEditor
				ref={editorRef}
				value={defaultValue}
				onChange={(nextValue) =>
					onChange(setLocaleValue(value, DEFAULT_LOCALE_KEY, nextValue))
				}
				placeholder={placeholder}
				mentionDataService={mentionDataService}
				className={cn(error && "border-destructive", className)}
				data-testid={testId}
			/>
		</div>
	)
}
