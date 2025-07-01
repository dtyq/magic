import { RoutePath } from "@/const/routes"
import { userStore } from "@/opensource/models/user"
import { useAccount } from "@/opensource/stores/authentication"
import { IconLogout, IconSwitchHorizontal } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { Modal } from "antd"
import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { BroadcastChannelSender } from "@/opensource/broadcastChannel"
import ComponentRender from "@/opensource/components/ComponentRender"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"

interface AccountActionsProps {
	onSwitchOrganization?: () => void
	onLogout?: () => void
	fetchWorkspaces?: () => void
}

const useStyles = createStyles(({ token, css, isDarkMode }) => {
	const backgroundColor = isDarkMode
		? token.magicColorScales.grey[0]
		: token.magicColorScales.white

	return {
		container: {
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			borderTop: `1px solid ${token.colorBorder}`,
			fontSize: "14px",
		},
		switchOrganization: {
			fontSize: "16px",
			color: "#333",
		},
		logoutItem: {
			color: token.colorError,
		},
		icon: {
			width: "20px",
			height: "20px",
		},
		item: {
			display: "flex",
			alignItems: "center",
			padding: "10px 11px",
			gap: "8px",
			cursor: "pointer",
		},
		dropdownRender: css`
			width: 300px;
			flex-direction: column;
			align-items: flex-start;
			margin-right: 10px;
			gap: 10px;
			background-color: ${backgroundColor};
			box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.1), 0 0 1px 0 rgba(0, 0, 0, 0.3);
			border-radius: 8px;
		`,
	}
})

export default observer(function AccountActions({
	onSwitchOrganization = () => console.log("切换组织"),
	onLogout = () => console.log("退出账号"),
}: AccountActionsProps) {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()
	const navigate = useNavigate()
	const [modalVisible, setModalVisible] = useState(false)
	/** 清除授权 */
	const { accountLogout, accountSwitch } = useAccount()

	const [modal, contextHolder] = Modal.useModal()

	const onClose = () => {
		setModalVisible(false)
		onSwitchOrganization?.()
	}
	/** 登出 */
	const handleLogout = useMemoizedFn(async () => {
		const config = {
			title: t("sider.exitTitle"),
			content: t("sider.exitContent"),
		}
		console.log(1111)
		const confirmed = await modal.confirm(config)
		console.log(confirmed, "confirmed")
		if (confirmed) {
			const accounts = userStore.account.accounts

			// 当且仅当存在多个账号下，优先切换帐号，再移除帐号
			if (accounts?.length > 1) {
				const info = userStore.user.userInfo
				const otherAccount = accounts.filter(
					(account) => account.magic_id !== info?.magic_id,
				)?.[0]

				const targetOrganization = otherAccount?.organizations.find(
					(org) => org.magic_organization_code === otherAccount?.organizationCode,
				)

				accountSwitch(
					targetOrganization?.magic_id ?? "",
					targetOrganization?.magic_id ?? "",
					targetOrganization?.magic_organization_code ?? "",
				).catch(console.error)

				if (info?.magic_id) {
					await accountLogout(info?.magic_id)
					/** 广播删除账号 */
					BroadcastChannelSender.deleteAccount(info?.magic_id, { navigateToLogin: false })
				}
			} else {
				await accountLogout()
				/** 广播删除账号 */
				BroadcastChannelSender.deleteAccount(undefined, { navigateToLogin: true })
				navigate(RoutePath.Login)
			}
			onLogout?.()
		}
	})

	return (
		<div className={styles.container}>
			<MagicDropdown
				trigger={["click"]}
				placement="top"
				open={modalVisible}
				onOpenChange={setModalVisible}
				dropdownRender={(originNode) => (
					<div className={styles.dropdownRender}>
						<ComponentRender componentName="OrganizationList" onClose={onClose}>
							{originNode}
						</ComponentRender>
					</div>
				)}
			>
				<div className={styles.item}>
					<IconSwitchHorizontal className={styles.icon} /> <span>切换组织</span>
				</div>
			</MagicDropdown>
			<div className={cx(styles.item, styles.logoutItem)} onClick={handleLogout}>
				<IconLogout className={styles.icon} /> <span>退出账号</span>
			</div>
			{contextHolder}
		</div>
	)
})
