import MagicModal from "@/components/base/MagicModal"
import type { ShareRange } from "@/pages/superMagic/components/Share/ShareFields/types"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { shouldConfirmOrganizationAllMembersBeforeSave } from "./organizationShareGuards"

type ShareTranslator = (key: string) => string

export function requestOrganizationAllMembersShareConfirm(t: ShareTranslator): Promise<boolean> {
	return new Promise((resolve) => {
		MagicModal.confirm({
			title: t("share.organizationAllMembersConfirmTitle"),
			content: t("share.organizationAllMembersConfirmContent"),
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			centered: true,
			zIndex: 1500,
			onOk: () => resolve(true),
			onCancel: () => resolve(false),
		})
	})
}

export async function ensureOrganizationAllMembersShareConfirmed(
	shareType: ShareType,
	shareRange: ShareRange,
	t: ShareTranslator,
): Promise<boolean> {
	if (!shouldConfirmOrganizationAllMembersBeforeSave(shareType, shareRange)) {
		return true
	}
	return requestOrganizationAllMembersShareConfirm(t)
}
