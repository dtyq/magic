import { useMemo } from "react"
import { useTranslation } from "react-i18next"

export default function useToolsParameters() {
	const { t } = useTranslation()

	const asyncCall = useMemo(() => {
		return {
			label: t("common.asyncCall", { ns: "flow" }),
			key: "async",
			tooltips: t("common.asyncCallDesc", { ns: "flow" }),
			defaultValue: false,
		}
	}, [t])

	return { asyncCall }
}
