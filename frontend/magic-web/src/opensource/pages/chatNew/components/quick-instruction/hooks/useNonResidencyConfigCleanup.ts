import { useMount } from "ahooks"

export const useNonResidencyConfigCleanup = (
	instructionId: string,
	innerConfigValue: any,
	isResidency: boolean,
	updateConfig: (config: Record<string, string>, isInner: boolean) => Promise<void>,
) => {
	useMount(() => {
		if (innerConfigValue && !isResidency) {
			try {
				updateConfig({ [instructionId]: "" }, true).catch((error) => {
					console.error("Failed to clear non-residency config:", error)
				})
			} catch (error) {
				console.error("Error in non-residency config cleanup:", error)
			}
		}
	})
}
