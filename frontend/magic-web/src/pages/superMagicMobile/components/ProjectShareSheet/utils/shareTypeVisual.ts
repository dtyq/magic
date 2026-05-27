import type { LucideIcon } from "lucide-react"
import { Globe, Lock, Users } from "lucide-react"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { formatExpireAt } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"

interface ShareTypeVisualMeta {
	Icon: LucideIcon
	cardClassName: string
	iconClassName: string
}

/**
 * Maps share types to prototype-aligned semantic colors for cards and icon circles.
 */
export function getShareTypeVisualMeta(shareType: ShareType): ShareTypeVisualMeta {
	if (shareType === ShareType.Public) {
		return {
			Icon: Globe,
			cardClassName: "bg-info/10",
			iconClassName: "bg-info/15 text-info",
		}
	}

	if (shareType === ShareType.Organization) {
		return {
			Icon: Users,
			cardClassName: "bg-success/10",
			iconClassName: "bg-success/15 text-success",
		}
	}

	return {
		Icon: Lock,
		cardClassName: "bg-warning/10",
		iconClassName: "bg-warning/15 text-warning",
	}
}

/**
 * Returns the i18n key for the detail type card title copy aligned with the prototype.
 */
export function getShareTypeDescriptionKey(shareType: ShareType): string {
	if (shareType === ShareType.Public) {
		return "projectShare.typePublicDescription"
	}

	if (shareType === ShareType.Organization) {
		return "projectShare.typeOrganizationDescription"
	}

	return "projectShare.typePasswordDescription"
}

interface DetailMetaShare {
	expire_at?: string
}

/**
 * Builds the subtitle under the type card: expiry prefix + relative created time.
 */
export function buildDetailMetaLabel({
	share,
	createdAtLabel,
	t,
}: {
	share: DetailMetaShare
	createdAtLabel: string
	t: (key: string, values?: Record<string, unknown>) => string
}): string {
	const expiryPart = share.expire_at
		? `${t("projectShare.expiresOn")} ${formatExpireAt(share.expire_at)}`
		: t("projectShare.expiresPermanent")

	return `${expiryPart} · ${createdAtLabel}`
}
