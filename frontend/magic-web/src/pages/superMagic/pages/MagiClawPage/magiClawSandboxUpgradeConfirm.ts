import type { MagicClawItem } from "@/apis"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

/** Same shape as useConfirmDialog().confirm options (subset). */
export interface MagiClawSandboxUpgradeConfirmInvoker {
	(options: {
		title?: string
		description?: string
		confirmText?: string
		dialogSize?: "default" | "sm"
		onConfirm: () => void
	}): void
}

/**
 * Opens the sandbox upgrade confirm dialog (same copy as Claw Playground).
 */
export function confirmMagiClawSandboxUpgrade(
	confirm: MagiClawSandboxUpgradeConfirmInvoker,
	params: {
		claw: MagicClawItem
		t: (key: string, values?: Record<string, unknown>) => string
		clawBrandValues?: Record<string, unknown>
		onConfirm: () => void
	},
) {
	const clawBrandValues = params.clawBrandValues ?? getClawBrandTranslationValues()
	const displayName =
		params.claw.name || params.t("superLobster.workspace.untitledProject", clawBrandValues)

	confirm({
		title: params.t("superLobster.workspace.upgradeConfirmTitle", {
			...clawBrandValues,
			name: displayName,
		}),
		description: params.t("superLobster.workspace.upgradeConfirmDescription", {
			...clawBrandValues,
		}),
		confirmText: params.t("superLobster.workspace.update", clawBrandValues),
		dialogSize: "sm",
		onConfirm: params.onConfirm,
	})
}
