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

/** 声明移动端壳层升级入口的版本适配点，默认版本不暴露企业版购买能力。 */
export function useMobileShellUpgradeAction(): MobileShellUpgradeAction {
	return unsupportedUpgradeAction
}
