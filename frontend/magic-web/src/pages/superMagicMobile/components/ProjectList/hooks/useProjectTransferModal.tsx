import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

/**
 * 默认实现保持空转让弹层，调用方通过能力位决定是否展示入口。
 */
function useProjectTransferModal(_project: ProjectListItem | null) {
	return {
		canTransferProject: false,
		openTransferModal: () => {},
		TransferModalComponent: null as React.ReactNode,
	}
}

export default useProjectTransferModal
