import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { CirclePlus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DEFAULT_LOCALE_KEY,
	type LocaleText,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { setLocaleValue } from "../LocaleTextInput"
import { PresetContentEditor, type PresetContentEditorHandle } from "./PresetContentEditor"
import { PresetContentLocaleDialog } from "./PresetContentLocaleDialog"

interface PresetContentLocaleEditorProps {
	value: LocaleText
	onChange: (value: LocaleText) => void
	placeholder?: string
	localizeLabel?: string
	"data-testid"?: string
}

function getDefaultLocaleValue(text: LocaleText): string {
	if (typeof text === "string") return text
	return text[DEFAULT_LOCALE_KEY] ?? ""
}

export function PresetContentLocaleEditor({
	value,
	onChange,
	placeholder,
	localizeLabel,
	"data-testid": testId,
}: PresetContentLocaleEditorProps) {
	const { t } = useTranslation("crew/create")
	const editorRef = useRef<PresetContentEditorHandle | null>(null)
	const defaultValue = getDefaultLocaleValue(value)

	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<div className="flex w-full items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 gap-2 px-3 text-xs font-medium text-foreground shadow-xs"
						onClick={() => editorRef.current?.insertPresetValue()}
						data-testid={testId ? `${testId}-insert-preset-value-btn` : undefined}
					>
						<CirclePlus className="h-4 w-4" />
						{t("playbook.edit.presets.form.insertPresetValue")}
					</Button>
					<PresetContentLocaleDialog
						value={value}
						onChange={onChange}
						placeholder={placeholder}
						localizeLabel={localizeLabel}
						data-testid={testId}
					/>
				</div>
			</div>
			<PresetContentEditor
				ref={editorRef}
				value={defaultValue}
				onChange={(nextValue) =>
					onChange(setLocaleValue(value, DEFAULT_LOCALE_KEY, nextValue))
				}
				placeholder={placeholder}
				data-testid={testId ? `${testId}-textarea` : undefined}
			/>
		</div>
	)
}
