export interface MobileShellUpgradeAction {
	isVisible: boolean
	label: string
	handleUpgradeClick: () => void
	handleUpgradePreload: () => void
}

const unsupportedUpgradeAction: MobileShellUpgradeAction = {
	isVisible: false,
	label: "",
	handleUpgradeClick: () => undefined,
	handleUpgradePreload: () => undefined,
}

/** 声明移动端壳层升级入口的适配点，默认实现不暴露购买动作。 */
export function useMobileShellUpgradeAction(): MobileShellUpgradeAction {
	return unsupportedUpgradeAction
}
