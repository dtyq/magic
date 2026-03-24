import MagicIcon from "@/components/base/MagicIcon"
import { IconWorld } from "@tabler/icons-react"
import MagicSelect from "@/components/base/MagicSelect"
import { isLanguageSwitchEnabled } from "@/models/config/languagePolicy"
import {
	setGlobalLanguage,
	useGlobalLanguage,
	useSupportLanguageOptions,
	useTheme,
} from "@/models/config/hooks"
import { cn } from "@/lib/utils"

function LanguageSelect() {
	const options = useSupportLanguageOptions()
	const lang = useGlobalLanguage()
	const { prefersColorScheme } = useTheme()
	const isDarkMode = prefersColorScheme === "dark"
	if (!isLanguageSwitchEnabled()) return null

	return (
		<MagicSelect
			prefix={
				<MagicIcon component={IconWorld} size={20} color={isDarkMode ? "#fff" : "#000"} />
			}
			value={lang}
			className={cn("w-fit rounded-full bg-white px-2 py-[5px] dark:bg-fill-secondary")}
			options={options}
			variant="borderless"
			placement="bottomRight"
			onChange={setGlobalLanguage}
			dataTestId="language-select"
			classNames={{
				popup: {
					root: "min-w-fit [&>*:not(:first-child)]:mt-1",
				},
			}}
		/>
	)
}

export default LanguageSelect
