import { useEffect } from "react"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"

interface UseNamedPageTitleOptions {
	pageTitle?: string
	entityName?: string | null
	fallbackName?: string | null
	isReady?: boolean
}

function normalizeTitlePart(value?: string | null) {
	return value?.trim() ?? ""
}

export function useNamedPageTitle({
	pageTitle,
	entityName,
	fallbackName,
	isReady = true,
}: UseNamedPageTitleOptions) {
	const { setMeta } = useMetaSet()

	useEffect(() => {
		if (!isReady) return

		const array = []

		const resolvedEntityName =
			normalizeTitlePart(entityName) || normalizeTitlePart(fallbackName)
		if (resolvedEntityName) {
			array.push(resolvedEntityName)
		}

		if (pageTitle) {
			array.push(pageTitle)
		}

		setMeta({
			title: array.join(" - "),
		})
	}, [entityName, fallbackName, isReady, pageTitle, setMeta])
}
