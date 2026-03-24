import MagicDropdown, { MagicDropdownProps } from "@/components/base/MagicDropdown"
import useLanguageOptions from "@/layouts/BaseLayout/components/UserMenus/hooks/useLanguageOptions"
import { isLanguageSwitchEnabled } from "@/models/config/languagePolicy"
import { setGlobalLanguage } from "@/models/config/hooks"

function LanguageSwitchDropdown({
	children,
	...props
}: { children: (props: { languageLabel: string }) => React.ReactNode } & Omit<
	MagicDropdownProps,
	"children"
>) {
	const { languageOptions, languageLabel } = useLanguageOptions()
	if (!isLanguageSwitchEnabled()) return children({ languageLabel })

	return (
		<MagicDropdown
			trigger={["click"]}
			{...props}
			menu={{
				items: languageOptions,
				onClick: (item) => {
					setGlobalLanguage(item.key)
				},
			}}
		>
			{children({ languageLabel })}
		</MagicDropdown>
	)
}

export default LanguageSwitchDropdown
