import { useCallback, useRef, useState } from "react"
import type { OptionItem } from "../../panels/types"
import type { MySlidesTemplateAdapter } from "@/pages/superMagic/services/mySlidesTemplateAdapter"

export type UpdateSlidesTemplateFavorite = (
	code: string,
	isFavorite: boolean,
	template: OptionItem,
) => void

export function useSlidesTemplateFavorite(
	adapter: Pick<MySlidesTemplateAdapter, "favorite" | "unfavorite">,
) {
	const pendingCodesRef = useRef(new Set<string>())
	const [pendingCodes, setPendingCodes] = useState<Set<string>>(() => new Set())

	const toggleFavorite = useCallback(
		async (
			template: OptionItem,
			updateFavorite: UpdateSlidesTemplateFavorite,
		): Promise<boolean | undefined> => {
			const code = typeof template.value === "string" ? template.value : ""
			if (!code || pendingCodesRef.current.has(code)) return

			const nextFavorite = !template.is_favorite
			pendingCodesRef.current.add(code)
			setPendingCodes((current) => new Set(current).add(code))
			updateFavorite(code, nextFavorite, template)

			try {
				if (nextFavorite) {
					await adapter.favorite(code)
				} else {
					await adapter.unfavorite(code)
				}
				return nextFavorite
			} catch (error) {
				updateFavorite(code, !nextFavorite, template)
				throw error
			} finally {
				pendingCodesRef.current.delete(code)
				setPendingCodes((current) => {
					const next = new Set(current)
					next.delete(code)
					return next
				})
			}
		},
		[adapter],
	)

	return { pendingCodes, toggleFavorite }
}
