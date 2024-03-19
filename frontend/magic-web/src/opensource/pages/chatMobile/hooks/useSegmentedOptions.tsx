import { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface SegmentedOption {
	label: string
	value: string
}

function useSegmentedOptions(): SegmentedOption[] {
	const { t } = useTranslation("interface")

	return useMemo(() => {
		return [
			{
				label: t("sider.message"),
				value: "chat",
			},
			{
				label: t("sider.aiAssistant"),
				value: "ai",
			},
		]
	}, [t])
}

export default useSegmentedOptions
