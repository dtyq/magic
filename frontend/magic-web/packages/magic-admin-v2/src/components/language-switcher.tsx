import { Check, Languages } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { isSupportedLanguage, languageOptions } from "@magic-admin-v2/i18n/resources"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { useTranslation } from "react-i18next"

export function LanguageSwitcher({ optionTestId, testId }: { optionTestId?: string; testId?: string }) {
	const { t } = useTranslation()
	const { canChangeLanguage, isChangingLanguage, language, setLanguage } = useI18n()
	const options = languageOptions.map((option) => ({
		label: t(option.labelKey),
		value: option.value,
	}))

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild data-testid="language-switcher-language-trigger">
				<button
					aria-label={t("language.toggle")}
					data-testid={testId}
					className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-input bg-card px-0 text-sm font-medium shadow-sm transition-colors hover:bg-accent data-[state=open]:bg-accent sm:w-auto sm:px-3"
					disabled={!canChangeLanguage || isChangingLanguage}
					type="button"
				>
					<Languages
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<span className="hidden sm:inline">
						{options.find((option) => option.value === language)?.label}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40" data-testid="language-switcher-action-button">
				{options.map((option) => (
					<DropdownMenuItem
						data-testid={optionTestId}
						key={option.value}
						onSelect={() => {
							if (isSupportedLanguage(option.value)) {
								void setLanguage(option.value)
							}
						}}
					>
						{option.label}
						{option.value === language ? <Check className="ml-auto size-4" /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
