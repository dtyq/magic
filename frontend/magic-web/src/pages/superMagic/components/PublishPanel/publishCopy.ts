import type { PublishInternalTarget, PublishMarketCopy, PublishTo } from "./types"

interface PublishCopyKeys {
	labelKey: string
	descriptionKey: string
}

export function getPublishToUiKey(publishTo: PublishTo) {
	return publishTo === "INTERNAL" ? "internal" : "market"
}

export function getInternalTargetUiKey(target: PublishInternalTarget) {
	switch (target) {
		case "MEMBER":
			return "specific_members"
		case "ORGANIZATION":
			return "organization"
		default:
			return "private"
	}
}

export function getPublishToCopyKeys({
	publishTo,
	marketCopy,
}: {
	publishTo: PublishTo
	marketCopy: PublishMarketCopy
}): PublishCopyKeys {
	if (publishTo === "INTERNAL") {
		return {
			labelKey: "skillEditPage.publishPanel.publishToOptions.internal.label",
			descriptionKey: "skillEditPage.publishPanel.publishToOptions.internal.description",
		}
	}

	return {
		labelKey: marketCopy.publishToLabelKey,
		descriptionKey: marketCopy.publishToDescriptionKey,
	}
}
