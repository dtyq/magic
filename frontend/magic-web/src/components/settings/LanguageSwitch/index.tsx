import { useGlobalLanguage, useSupportLanguageOptions } from "@/models/config/hooks"
import { Select } from "antd"
import { observer } from "mobx-react-lite"
import { service } from "@/services"
import type { ConfigService } from "@/services/config/ConfigService"
import type { Variant } from "antd/es/config-provider"
import { cn } from "@/utils/cn"
import type { Config } from "@/models/config/types"

interface LanguageSwitchProps {
	className?: string
	popupClassName?: string
	variant?: Variant
}

const LanguageSwitch = observer((props: LanguageSwitchProps) => {
	const { className, popupClassName, variant } = props

	const lang = useGlobalLanguage()
	const languageSelected = useGlobalLanguage(false)
	const options = useSupportLanguageOptions()

	return (
		<Select
			value={lang}
			className={cn("w-full", className)}
			options={options}
			variant={variant}
			placement="bottomRight"
			onChange={(language: Config.LanguageValue) =>
				service.get<ConfigService>("configService").setLanguage(language)
			}
			classNames={{
				popup: {
					root: popupClassName,
				},
			}}
			optionRender={(option) => {
				const label = option.data.translations?.[option.data.value] ?? option.data.label
				const tip = option.data.translations?.[languageSelected] ?? option.data.value
				return (
					<div className="flex h-8 items-center">
						<div className="flex-1 overflow-hidden">
							{/* Show the native language name above its translation in the current language. */}
							<div className="flex h-5 items-center text-sm">
								<span className="flex-[1_0_0] truncate font-semibold">{label}</span>
							</div>
							<div className="flex h-4 flex-[1_0_0] items-center text-xs text-neutral-500 dark:text-neutral-200">
								{tip}
							</div>
						</div>
					</div>
				)
			}}
		/>
	)
})

export default LanguageSwitch
