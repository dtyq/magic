import MagicDropdown, { MagicDropdownProps } from "@/opensource/components/base/MagicDropdown"
import useLanguageOptions from "@/opensource/layouts/BaseLayout/components/UserMenus/hooks/useLanguageOptions"
import { setGlobalLanguage } from "@/opensource/models/config/hooks"

function LanguageSwitchDropdown({
	children,
	...props
}: { children: (props: { languageLabel: string }) => React.ReactNode } & Omit<
	MagicDropdownProps,
	"children"
>) {
	const { languageOptions, languageLabel } = useLanguageOptions()

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
