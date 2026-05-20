import { ResourceType } from "@/pages/superMagic/components/Share/types"
import type { MobileShareItem } from "../types"

/**
 * Returns whether the share record is a whole-project share.
 * Whole-project shares cover all shareable files in the project; detail/manage views must not show the selected-files hierarchy.
 */
export function isWholeProjectShare(share: MobileShareItem): boolean {
	if ("share_project" in share && share.share_project) {
		return true
	}

	if (share.resource_type === ResourceType.Project) {
		return true
	}

	return false
}

/**
 * Returns whether the share record is a partial (selected-files) share; the detail view may show the selected-files hierarchy.
 */
export function isPartialFileShare(share: MobileShareItem): boolean {
	return !isWholeProjectShare(share)
}
