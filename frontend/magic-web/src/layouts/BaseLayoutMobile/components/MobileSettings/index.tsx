import { useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"

import { useUserInfo } from "@/models/user/hooks"
import useLogout from "@/hooks/account/useLogout"
import useNavigate from "@/routes/hooks/useNavigate"
import { MobileSettingsAccountSecuritySheet } from "./components/AccountSecuritySheet"
import { MobileSettingsAppSettingsLanguageSheet } from "./components/AppSettingsLanguageSheet"
import { MobileSettingsAppSettingsSheet } from "./components/AppSettingsSheet"
import { MobileSettingsAppSettingsTimezoneSheet } from "./components/AppSettingsTimezoneSheet"
import { MobileSettingsFeedbackSheet } from "./components/FeedbackSheet"
import { MobileSettingsLoginDevicesSheet } from "./components/LoginDevicesSheet"
import {
	MobileSettingsPasswordPickerSheet,
	MobileSettingsPasswordSheet,
	type MobileSettingsPasswordMethod,
} from "./components/PasswordSecuritySheets"
import { MobileSettingsPhoneSecuritySheet } from "./components/PhoneSecuritySheet"
import { MobileSettingsProfileSheet } from "./components/ProfileSheet"
import {
	getMobileSettingsRootItemAction,
	MobileSettingsOrderHistorySheet,
	MobileSettingsPointsDetailSheet,
	MobileSettingsPointsSheet,
	MobileSettingsRootSheet,
} from "./renderers"
import type { MobileSettingsPanelKey, MobileSettingsRootItemKey } from "./types"

/** 设置面板入口只维护 root 开关与 panel 栈，具体菜单与面板渲染都下沉到共享渲染层。 */
function MobileSettingsPanelComponent(props: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const { open, onOpenChange } = props
	const navigate = useNavigate()
	const { userInfo } = useUserInfo()
	const [panelStack, setPanelStack] = useState<MobileSettingsPanelKey[]>([])
	const [passwordMethod, setPasswordMethod] = useState<MobileSettingsPasswordMethod>("phone")

	/** 根面板关闭时统一清空当前嵌套 panel 栈，确保再次进入时总是回到设置首页。 */
	const handleCloseRoot = useMemoizedFn(() => {
		setPanelStack([])
		onOpenChange(false)
	})

	const logout = useLogout({ onConfirm: handleCloseRoot })

	/** panel 栈按打开顺序维护层叠关系，避免入口文件为每个 sheet 单独维护布尔状态。 */
	const openPanel = useMemoizedFn((panel: MobileSettingsPanelKey) => {
		setPanelStack((prev) => (prev.includes(panel) ? prev : [...prev, panel]))
	})

	/** 关闭某个父 panel 时顺带移除其后的所有子 panel，保持层叠返回路径稳定。 */
	const closePanelAndDescendants = useMemoizedFn((panel: MobileSettingsPanelKey) => {
		setPanelStack((prev) => {
			const panelIndex = prev.indexOf(panel)
			return panelIndex === -1 ? prev : prev.slice(0, panelIndex)
		})
	})

	/** 只要 root 面板外部被关闭，就同步清空内部栈，避免父子状态漂移。 */
	useEffect(() => {
		if (!open) {
			setPanelStack([])
		}
	}, [open])

	/** 一级菜单点击统一经过 action resolver，减少入口文件里的分支和 handleOpenXxx 方法。 */
	const handleSelectRootItem = useMemoizedFn((itemKey: MobileSettingsRootItemKey) => {
		const action = getMobileSettingsRootItemAction(itemKey)

		switch (action.type) {
			case "panel":
				openPanel(action.panel)
				return
			case "route":
				handleCloseRoot()
				navigate({ name: action.routeName })
				return
			case "effect":
				if (action.effect === "logout") {
					logout()
				}
				return
		}
	})

	/** 手机号操作继续叠在账号安全之上，关闭后回到账号安全列表。 */
	const handleOpenPhoneSecuritySheet = useMemoizedFn(() => {
		openPanel("phoneSecurity")
	})

	/** 密码修改先进入验证方式选择层，再进入最终的新密码设置层。 */
	const handleOpenChangePassword = useMemoizedFn(() => {
		openPanel("passwordPicker")
	})

	/** 选定验证方式后关闭选择层并打开最终密码编辑层，保持 panel 栈顺序正确。 */
	const handleSelectPasswordMethod = useMemoizedFn((method: MobileSettingsPasswordMethod) => {
		setPasswordMethod(method)
		closePanelAndDescendants("passwordPicker")
		openPanel("passwordEditor")
	})

	/** 应用设置下的语言子层继续入栈，关闭时自然回到父级 app settings。 */
	const handleOpenAppSettingsLanguageSheet = useMemoizedFn(() => {
		openPanel("appSettingsLanguage")
	})

	/** 应用设置下的时区子层与语言共享同一栈模型，保证返回路径一致。 */
	const handleOpenAppSettingsTimezoneSheet = useMemoizedFn(() => {
		openPanel("appSettingsTimezone")
	})

	const hasPanelOpen = useMemoizedFn((panel: MobileSettingsPanelKey) =>
		panelStack.includes(panel),
	)

	return (
		<>
			<MobileSettingsRootSheet
				open={open}
				onClose={handleCloseRoot}
				onSelectItem={handleSelectRootItem}
			/>
			<MobileSettingsPointsSheet
				open={hasPanelOpen("pointsPurchase")}
				onClose={() => closePanelAndDescendants("pointsPurchase")}
			/>
			<MobileSettingsPointsDetailSheet
				open={hasPanelOpen("pointsDetail")}
				onClose={() => closePanelAndDescendants("pointsDetail")}
			/>
			<MobileSettingsOrderHistorySheet
				open={hasPanelOpen("orderHistory")}
				onClose={() => closePanelAndDescendants("orderHistory")}
			/>
			<MobileSettingsProfileSheet
				open={hasPanelOpen("profile")}
				onClose={() => closePanelAndDescendants("profile")}
			/>
			<MobileSettingsFeedbackSheet
				open={hasPanelOpen("feedback")}
				onClose={() => closePanelAndDescendants("feedback")}
			/>
			<MobileSettingsAccountSecuritySheet
				open={hasPanelOpen("accountSecurity")}
				onClose={() => closePanelAndDescendants("accountSecurity")}
				phone={userInfo?.phone}
				countryCode={userInfo?.country_code}
				onOpenPhone={handleOpenPhoneSecuritySheet}
				onOpenPassword={handleOpenChangePassword}
			/>
			<MobileSettingsPhoneSecuritySheet
				open={hasPanelOpen("phoneSecurity")}
				onClose={() => closePanelAndDescendants("phoneSecurity")}
				currentPhone={userInfo?.phone}
				defaultCountryCode={userInfo?.country_code}
			/>
			<MobileSettingsLoginDevicesSheet
				open={hasPanelOpen("loginDevices")}
				onClose={() => closePanelAndDescendants("loginDevices")}
			/>
			<MobileSettingsPasswordPickerSheet
				open={hasPanelOpen("passwordPicker")}
				onClose={() => closePanelAndDescendants("passwordPicker")}
				hasPhone={Boolean(userInfo?.phone)}
				hasEmail={Boolean(userInfo?.email)}
				onSelect={handleSelectPasswordMethod}
			/>
			<MobileSettingsPasswordSheet
				open={hasPanelOpen("passwordEditor")}
				onClose={() => closePanelAndDescendants("passwordEditor")}
				method={passwordMethod}
				currentPhone={userInfo?.phone}
				currentEmail={userInfo?.email}
				countryCode={userInfo?.country_code}
			/>
			<MobileSettingsAppSettingsSheet
				open={hasPanelOpen("appSettings")}
				onClose={() => closePanelAndDescendants("appSettings")}
				onOpenLanguage={handleOpenAppSettingsLanguageSheet}
				onOpenTimezone={handleOpenAppSettingsTimezoneSheet}
			/>
			<MobileSettingsAppSettingsLanguageSheet
				open={hasPanelOpen("appSettingsLanguage")}
				onClose={() => closePanelAndDescendants("appSettingsLanguage")}
			/>
			<MobileSettingsAppSettingsTimezoneSheet
				open={hasPanelOpen("appSettingsTimezone")}
				onClose={() => closePanelAndDescendants("appSettingsTimezone")}
			/>
		</>
	)
}

export const MobileSettingsPanel = observer(MobileSettingsPanelComponent)

export default MobileSettingsPanel
