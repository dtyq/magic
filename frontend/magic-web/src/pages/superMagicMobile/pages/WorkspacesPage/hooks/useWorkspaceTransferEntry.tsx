import { useTranslation } from "react-i18next"
import type {
	UseWorkspaceTransferEntryParams,
	UseWorkspaceTransferEntryResult,
} from "./useWorkspaceTransferEntry.types"

/**
 * 默认实现保持空入口，只提供稳定调用面给共享组件消费。
 */
export function useWorkspaceTransferEntry({
	workspace: _workspace,
	onClose: _onClose,
}: UseWorkspaceTransferEntryParams): UseWorkspaceTransferEntryResult {
	const { t } = useTranslation("super")

	/** 当前实现不渲染转让入口，这里显式保持 no-op。 */
	function handleOpenTransfer() {}

	return {
		showTransferEntry: false,
		transferEntryLabel: t("workspace.transfer"),
		handleOpenTransfer,
		transferNode: null,
	}
}
