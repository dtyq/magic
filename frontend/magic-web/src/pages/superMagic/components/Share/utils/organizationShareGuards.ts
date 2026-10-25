import { ShareType } from "@/pages/superMagic/components/Share/types"
import type { ShareRange } from "@/pages/superMagic/components/Share/ShareFields/types"

/** Default scope for new organization shares — avoids accidental whole-team visibility. */
export const DEFAULT_NEW_ORGANIZATION_SHARE_RANGE: ShareRange = "designated"

export function isOrganizationAllMembersShare(
	shareType: ShareType,
	shareRange: ShareRange,
): boolean {
	return shareType === ShareType.Organization && shareRange === "all"
}

export function isOrganizationDesignatedShareIncomplete(
	shareType: ShareType,
	shareRange: ShareRange,
	targetCount: number,
): boolean {
	return shareType === ShareType.Organization && shareRange === "designated" && targetCount === 0
}

export function shouldConfirmOrganizationAllMembersBeforeSave(
	shareType: ShareType,
	shareRange: ShareRange,
): boolean {
	return isOrganizationAllMembersShare(shareType, shareRange)
}
