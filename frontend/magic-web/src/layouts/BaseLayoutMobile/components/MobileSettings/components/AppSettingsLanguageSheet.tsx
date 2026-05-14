import { Check } from "lucide-react"
import { useMemoizedFn } from "ahooks"

import { useTranslation } from "react-i18next"

import { service } from "@/services"
import type { ConfigService } from "@/services/config/ConfigService"
import { useGlobalLanguage, useSupportLanguageOptions } from "@/models/config/hooks"
import type { Config } from "@/models/config/types"

import { MOBILE_SETTINGS_SECTION_CLASSNAME } from "../constants"
import { MobileSettingsSheetContainer } from "./SheetContainer"

/** 语言子弹窗继续复用旧配置逻辑，只把展示形态从路由页替换成设置内嵌套浮窗。 */
export function MobileSettingsAppSettingsLanguageSheet(props: {
	open: boolean
	onClose: () => void
}) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const currentLanguage = useGlobalLanguage()
	const languageOptions = useSupportLanguageOptions()

	/** 语言变更沿用既有 ConfigService，迁移后仍保持原来的全局广播和持久化行为。 */
	const handleLanguageChange = useMemoizedFn((language: string) => {
		service.get<ConfigService>("configService").setLanguage(language as Config.LanguageValue)
		onClose()
	})

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.language")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			contentClassName="gap-2.5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-app-language-sheet"
		>
			<div className={MOBILE_SETTINGS_SECTION_CLASSNAME}>
				{languageOptions.map((option, index) => {
					const label = option.translations?.[option.value as string] ?? option.label
					const selected = option.value === currentLanguage

					return (
						<div key={option.value}>
							<button
								type="button"
								onClick={() => handleLanguageChange(option.value)}
								className="flex h-12 w-full items-center gap-3 bg-transparent px-3.5 transition-opacity active:opacity-60"
								data-testid={`mobile-settings-language-option-${option.value}`}
							>
								<span className="flex-1 text-left text-base leading-5 text-foreground">
									{label}
								</span>
								{selected ? (
									<Check
										className="h-[18px] w-[18px] shrink-0 text-primary"
										strokeWidth={2.5}
									/>
								) : null}
							</button>
							{index < languageOptions.length - 1 ? (
								<div className="pl-3.5">
									<div className="h-px w-full bg-border" />
								</div>
							) : null}
						</div>
					)
				})}
			</div>
		</MobileSettingsSheetContainer>
	)
}
