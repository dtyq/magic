import { useTranslation } from "react-i18next"
import type {
	UseWorkspaceTransferEntryParams,
	UseWorkspaceTransferEntryResult,
} from "./useWorkspaceTransferEntry.types"

/**
 * 开源版保持空实现，只提供稳定调用面给共享组件消费。
 */
export function useWorkspaceTransferEntry({
	workspace: _workspace,
	onClose: _onClose,
}: UseWorkspaceTransferEntryParams): UseWorkspaceTransferEntryResult {
	const { t } = useTranslation("super")

	/**
	 * 共享基线不承载企业版转让能力，这里显式保持 no-op。
	 */
	function handleOpenTransfer() {}

	return {
		showTransferEntry: false,
		transferEntryLabel: t("workspace.transfer"),
		handleOpenTransfer,
		transferNode: null,
	}
}
