/**
 * 工具面板
 */

import { useBoolean, useMemoizedFn } from "ahooks"

export default function useToolsPanel() {
	const [isToolsPanelOpen, { setFalse, setTrue }] = useBoolean(false)

	const openToolsPanel = useMemoizedFn(() => {
		setTrue()
	})

	const closeToolsPanel = useMemoizedFn(() => {
		setFalse()
	})

	return {
		openToolsPanel,
		closeToolsPanel,
		isToolsPanelOpen,
	}
}
