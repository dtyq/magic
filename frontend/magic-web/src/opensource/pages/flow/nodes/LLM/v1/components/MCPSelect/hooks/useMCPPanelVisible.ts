/**
 * tool panel
 */

import { useBoolean, useMemoizedFn } from "ahooks"

export default function useMCPPanel() {
	const [isMCPPanelOpen, { setFalse, setTrue }] = useBoolean(false)

	const openMCPPanel = useMemoizedFn(() => {
		setTrue()
	})

	const closeMCPPanel = useMemoizedFn(() => {
		setFalse()
	})

	return {
		openMCPPanel,
		closeMCPPanel,
		isMCPPanelOpen,
	}
}
