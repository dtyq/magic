import { useGlobalLanguage, useSupportLanguageOptions } from "@/models/config/hooks"
import { Select } from "antd"
import { observer } from "mobx-react-lite"
import { service } from "@/services"
import type { ConfigService } from "@/services/config/ConfigService"
import type { Variant } from "antd/es/config-provider"
import { useStyles } from "./styles"
import type { Config } from "@/models/config/types"

interface LanguageSwitchProps {
	className?: string
	popupClassName?: string
	variant?: Variant
}

const LanguageSwitch = observer((props: LanguageSwitchProps) => {
	const { className, popupClassName, variant } = props
	const { styles, cx } = useStyles()

	const lang = useGlobalLanguage()
	const languageSelected = useGlobalLanguage(false)
	const options = useSupportLanguageOptions()

	return (
		<Select
			value={lang}
			className={cx(styles.select, className)}
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
					<div className={styles.menuItem}>
						<div className={styles.menuItemLeft}>
							<div className={styles.menuItemTop}>
								<span className={styles.menuItemTopName}>{label}</span>
							</div>
							<div className={styles.menuItemBottom}>{tip}</div>
						</div>
					</div>
				)
			}}
		/>
	)
})

export default LanguageSwitch
