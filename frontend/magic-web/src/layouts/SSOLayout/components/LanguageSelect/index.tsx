import MagicIcon from "@/components/base/MagicIcon"
import { IconWorld } from "@tabler/icons-react"
import MagicSelect from "@/components/base/MagicSelect"
import {
	setGlobalLanguage,
	useGlobalLanguage,
	useSupportLanguageOptions,
} from "@/models/config/hooks"

function LanguageSelect() {
	const options = useSupportLanguageOptions()
	const lang = useGlobalLanguage()

	return (
		<MagicSelect
			prefix={
				<MagicIcon component={IconWorld} size={20} className="text-black dark:text-white" />
			}
			value={lang}
			className="w-fit rounded-full bg-white px-2 py-[5px] dark:bg-fill-secondary"
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
