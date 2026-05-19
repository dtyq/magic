import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { confirmMagiClawSandboxUpgrade } from "@/pages/superMagic/pages/MagiClawPage/magiClawSandboxUpgradeConfirm"
import type { ClawPlaygroundRootStore } from "../store/root-store"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface UseClawSandboxUpgradeActionParams {
	store: ClawPlaygroundRootStore
}

export function useClawSandboxUpgradeAction({ store }: UseClawSandboxUpgradeActionParams) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const { confirm, dialog } = useConfirmDialog()

	const handleUpgradeSandbox = useMemoizedFn(async () => {
		const isSuccess = await store.upgradeSandbox()
		if (isSuccess) {
			toast.success(t("superLobster.workspace.upgradeSuccess", clawBrandValues))
			return
		}

		toast.error(t("superLobster.workspace.upgradeFailed", clawBrandValues))
	})

	const handleConfirmUpgradeSandbox = useMemoizedFn(() => {
		const magicClaw = store.magicClaw
		if (!magicClaw || store.isUpgradingSandbox) return

		confirmMagiClawSandboxUpgrade(confirm, {
			claw: magicClaw,
			t,
			clawBrandValues,
			onConfirm: () => {
				void handleUpgradeSandbox()
			},
		})
	})

	return {
		dialog,
		handleConfirmUpgradeSandbox,
	}
}
