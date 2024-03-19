import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { SegmentedKey } from "../constants"

/**
 * Hook for managing segmented control state
 */
export function useSegmentedControl() {
	const { t } = useTranslation("interface")
	const [activeSegmentedKey, setActiveSegmentedKey] = useState<SegmentedKey>(SegmentedKey.Message)
	const [aiHydrated, setAiHydrated] = useState(false)

	const options = useMemo(() => {
		return [
			{
				label: t("chat.subSider.message"),
				value: SegmentedKey.Message,
			},
			{
				label: t("chat.subSider.aiBots"),
				value: SegmentedKey.AiBots,
			},
		]
	}, [t])

	const handleSegmentedChange = useMemoizedFn((key: SegmentedKey) => {
		setActiveSegmentedKey(key)
		if (key === SegmentedKey.AiBots && !aiHydrated) {
			setAiHydrated(true)
		}
	})

	return {
		activeSegmentedKey,
		aiHydrated,
		options,
		handleSegmentedChange,
		setAiHydrated,
	}
}
