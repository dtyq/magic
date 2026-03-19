import { useMemo } from "react"
import { useTranslation } from "react-i18next"

export default function usePanelConfig() {
	const { t } = useTranslation()
	const limit = useMemo(() => {
		return {
			label: t("common.maxReturnCount", { ns: "flow" }),
			tooltips: t("common.maxReturnCountDesc", { ns: "flow" }),
			defaultValue: 5,
			extra: {
				step: 1,
				max: 10,
				min: 1,
			},
		}
	}, [t])

	const score = useMemo(() => {
		return {
			label: t("common.minMatchRatio", { ns: "flow" }),
			tooltips: t("common.minMatchRatioDesc", { ns: "flow" }),
			defaultValue: 0.4,
			extra: {
				step: 0.01,
				max: 0.99,
				min: 0.01,
			},
		}
	}, [t])

	return {
		limit,
		score,
	}
}
