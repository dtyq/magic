import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicMenu from "@/opensource/components/base/MagicMenu"
import { useAccount } from "@/opensource/stores/authentication"
import {
	IconCheck,
	IconChevronRight,
	IconLogout,
	IconUserCog,
	IconWorld,
} from "@tabler/icons-react"
import { useBoolean, useMemoizedFn } from "ahooks"
import type { MenuProps } from "antd"
import { Popover, Modal, Flex } from "antd"
import { useMemo, type PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"
import { last } from "lodash-es"
import { RoutePath } from "@/const/routes"
import { useStyles } from "./styles"
import { UserMenuKey } from "./constants"
import { ItemType } from "antd/es/menu/interface"
import { useTheme } from "antd-style"
import {
	setGlobalLanguage,
	useGlobalLanguage,
	useSupportLanguageOptions,
} from "@/opensource/models/config/hooks"
import { SettingSection } from "@/opensource/pages/settings/types"
import useNavigate from "@/opensource/hooks/useNavigate"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"

interface UserMenusProps extends PropsWithChildren {}

const UserMenus = observer(function UserMenus({ children }: UserMenusProps) {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()
	const { magicColorUsages } = useTheme()

	const navigate = useNavigate()
	const [modal, contextHolder] = Modal.useModal()

	const [open, { setFalse, set }] = useBoolean(false)

	/** 清除授权 */
	const { accountLogout, accountSwitch } = useAccount()

	/** 登出 */
	const handleLogout = useMemoizedFn(async () => {
		const config = {
			title: t("sider.exitTitle"),
			content: t("sider.exitContent"),
		}
		const confirmed = await modal.confirm(config)
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
				}
			} else {
				await accountLogout()
				navigate(RoutePath.Login)
			}
		}
	})

	const accountManagement = useMemoizedFn(() => {
		navigate(RoutePath.Settings, { state: { type: SettingSection.ACCOUNT_MANAGE } })
	})

	const deviceManagement = useMemoizedFn(() => {
		navigate(RoutePath.Settings, { state: { type: SettingSection.LOGIN_DEVICES } })
	})

	/** 当前语言 */
	const language = useGlobalLanguage(true)
	/** 语言列表 */
	const languageList = useSupportLanguageOptions()

	const languageOptions = useMemo(() => {
		return languageList.reduce((acc, item) => {
			const label = item.translations?.[item.value] ?? item.label

			acc.push({
				key: item.value,
				label: (
					<Flex align="center" justify="space-between">
						<span className={styles.menuItemTopName}>{label}</span>
						{item.value === language && (
							<MagicIcon
								className={styles.arrow}
								component={IconCheck}
								color={magicColorUsages.primary.default}
							/>
						)}
					</Flex>
				),
			})

			if (item.value === "auto") {
				acc.push({
					type: "divider",
				})
			}

			return acc
		}, [] as ItemType[])
	}, [
		languageList,
		styles.menuItemTopName,
		styles.arrow,
		language,
		magicColorUsages.primary.default,
	])

	// const isAdmin = userStore.user.isAdmin

	const menu = useMemo<MenuProps["items"]>(() => {
		return [
			{
				label: (
					<Flex align="center" justify="center" gap={24}>
						<span>{t("sider.switchLanguage")}</span>
						<MagicIcon className={styles.arrow} component={IconChevronRight} />
					</Flex>
				),
				key: UserMenuKey.SwitchLanguage,
				icon: <MagicIcon size={20} component={IconWorld} color="currentColor" />,
				children: languageOptions,
			},
			{
				label: t("sider.accountManagement"),
				key: UserMenuKey.AccountManagement,
				icon: <MagicIcon size={20} component={IconUserCog} color="currentColor" />,
			},
			// {
			// 	label: t("sider.deviceManagement"),
			// 	key: UserMenuKey.DeviceManagement,
			// 	icon: <MagicIcon size={20} component={IconDeviceMobile} color="currentColor" />,
			// },
			// isAdmin && {
			// 	type: "divider",
			// },
			// isAdmin && {
			// 	label: t("sider.admin"),
			// 	key: UserMenuKey.Admin,
			// 	icon: <MagicIcon size={20} component={IconDeviceImacCog} color="currentColor" />,
			// },
			{
				type: "divider",
			},
			{
				label: t("sider.logout"),
				icon: <MagicIcon size={20} component={IconLogout} color="currentColor" />,
				danger: true,
				key: UserMenuKey.Logout,
			},
		].filter(Boolean) as ItemType[]
	}, [t, styles.arrow, languageOptions])

	const selectKeys = useMemo(
		() => (language ? [UserMenuKey.SwitchLanguage, language] : []),
		[language],
	)

	// const navigateToAdmin = useMemoizedFn(() => {
	// 	openNewTab(AdminRoutePath.AdminHome.replace("*", AdminRoutePath.Ai))
	// })

	const handleMenuClick = useMemoizedFn<Exclude<MenuProps["onClick"], undefined>>(
		({ key, keyPath }) => {
			switch (last(keyPath)) {
				case UserMenuKey.Logout:
					handleLogout()
					break
				case UserMenuKey.SwitchLanguage:
					setGlobalLanguage(key)
					break
				case UserMenuKey.AccountManagement:
					accountManagement()
					break
				case UserMenuKey.DeviceManagement:
					deviceManagement()
					break
				// case UserMenuKey.Admin:
				// 	navigateToAdmin()
				// break
				default:
					break
			}
			setFalse()
		},
	)

	return (
		<>
			<Popover
				classNames={{ root: styles.popover }}
				placement="rightTop"
				arrow={false}
				open={open}
				onOpenChange={set}
				content={
					<MagicMenu
						rootClassName={cx(styles.menu)}
						items={menu}
						expandIcon={null}
						onClick={handleMenuClick}
						selectedKeys={selectKeys}
					/>
				}
				trigger="click"
			>
				{children}
			</Popover>
			{contextHolder}
		</>
	)
})

export default UserMenus
