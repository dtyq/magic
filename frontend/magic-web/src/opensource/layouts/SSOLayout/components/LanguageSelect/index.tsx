import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconWorld } from "@tabler/icons-react"
import MagicSelect from "@/opensource/components/base/MagicSelect"
import {
	setGlobalLanguage,
	useGlobalLanguage,
	useSupportLanguageOptions,
	useTheme,
} from "@/opensource/models/config/hooks"
import { cn } from "@/opensource/lib/utils"

function LanguageSelect() {
	const options = useSupportLanguageOptions()
	const lang = useGlobalLanguage()
	const { prefersColorScheme } = useTheme()
	const isDarkMode = prefersColorScheme === "dark"

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
