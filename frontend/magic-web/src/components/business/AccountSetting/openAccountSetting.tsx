import { Suspense } from "react"
import { Flex } from "antd"
import { getI18n } from "react-i18next"
import MagicSpin from "@/components/base/MagicSpin"
import { openSettingPanel } from "@/components/business/SettingPanel/openSettingPanel"
import { getAccountSettingMenuItems, type AccountSettingMenuItem } from "./config"
import type { AccountSettingPage } from "./types"

const i18n = getI18n()

export interface OpenAccountSettingOptions {
	defaultActiveKey?: AccountSettingPage
	onClose?: () => void
	width?: number | string
	height?: number | string
}

export function openAccountSetting(options: OpenAccountSettingOptions = {}) {
	const { defaultActiveKey, onClose, width, height } = options
	const t = (key: string) => i18n.t(key, { ns: "accountSetting" })
	const menuItems = getAccountSettingMenuItems(t)

	const loadingFallback = (
		<Flex
			flex={1}
			vertical
			align="center"
			justify="center"
			style={{ width: "100%", height: "100%" }}
		>
			<MagicSpin spinning />
		</Flex>
	)

	return openSettingPanel({
		menuItems,
		renderContent: (key) => {
			const item = menuItems.find((menuItem) => menuItem.key === key) as
				| AccountSettingMenuItem
				| undefined

			return <Suspense fallback={loadingFallback}>{item?.component}</Suspense>
		},
		defaultActiveKey: defaultActiveKey || menuItems[0]?.key,
		onClose,
		width: width || 900,
		height: height || 600,
	})
}
