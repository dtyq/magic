import { ChevronLeft } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { Button } from "@/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import { useGlobalLanguage, useSupportLanguageOptions } from "@/models/config/hooks"
import { service } from "@/services"
import type { ConfigService } from "@/services/config/ConfigService"
import type { Config } from "@/models/config/types"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

function LanguageSelector() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()

	const currentLanguage = useGlobalLanguage()
	const options = useSupportLanguageOptions()

	// Return to the previous page using the existing transition.
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				type: "slide",
				direction: "right",
			},
		})
	})

	const handleLanguageChange = useMemoizedFn((language: Config.LanguageValue) => {
		service.get<ConfigService>("configService").setLanguage(language)
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">
						{t("setting.language")}
					</div>
				</div>
			</div>

			{/* Content */}
			<ScrollArea
				className="grid min-h-0 flex-1"
				viewportClassName="h-auto min-h-0 [&>div]:!block"
			>
				<div className="flex w-full flex-col bg-popover">
					{options.map((option) => {
						const label =
							option.translations?.[option.value as Config.LanguageValue] ??
							option.label
						const isSelected = currentLanguage === option.value

						return (
							<div
								key={option.value}
								onClick={() =>
									handleLanguageChange(option.value as Config.LanguageValue)
								}
								className="flex w-full items-center justify-between gap-2 border-b border-border bg-popover px-6 py-3 last:border-b-0"
							>
								<div className="text-sm text-foreground">{label}</div>
								{isSelected && <Checkbox checked={true} className="size-4" />}
							</div>
						)
					})}
				</div>
			</ScrollArea>
		</div>
	)
}

export default observer(LanguageSelector)
