import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { useGlobalLanguage, useSupportLanguageOptions } from "@/models/config/hooks"
import { Flex } from "antd"
import { ItemType } from "antd/es/menu/interface"
import { useMemo } from "react"

function useLanguageOptions() {
	// Current language
	const language = useGlobalLanguage(true)
	// Language list
	const languageList = useSupportLanguageOptions()

	const languageLabel = useMemo(() => {
		const langOption = languageList.find((option) => option.value === language)
		return langOption?.label || language
	}, [language, languageList])

	const languageOptions = useMemo(() => {
		return languageList.reduce((acc, item) => {
			const label = item.translations?.[item.value] ?? item.label

			acc.push({
				key: item.value,
				label: (
					<Flex style={{ width: "100%" }} align="center" justify="space-between">
						<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
							{label}
						</span>
						{item.value === language && <Checkbox checked />}
					</Flex>
				),
			})

			if (item.value === "auto") {
				acc.push({
					type: "divider",
				})
			}

			return acc
		}, [] as ItemType[])
	}, [languageList, language])

	return { languageOptions, language, languageLabel }
}

export default useLanguageOptions
