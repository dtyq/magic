// Styles
import { useStyles } from "./styles"

// Types
import OrganizationRender from "@/opensource/components/business/OrganizationRender"
import { observer } from "mobx-react-lite"
import { userStore } from "@/opensource/models/user"
import ComponentRender from "@/opensource/components/ComponentRender"
import { DefaultComponents } from "@/opensource/components/ComponentRender/config/defaultComponents"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconMagicBots } from "@/opensource/enhance/tabler/icons-react"
import { useTheme } from "antd-style"
import { IconChevronRight, IconUsers } from "@tabler/icons-react"
import { memo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentOrganizationData } from "../contacts/components/ContactsCurrentOrganization/hooks"
import { useContactPageDataContext } from "../contacts/components/ContactDataProvider/hooks"
import { useMemoizedFn } from "ahooks"
import { interfaceStore } from "@/opensource/stores/interface"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"
import UserHeader from "../chatMobile/components/UserHeader"
import { cn } from "@/opensource/lib/utils"

const CheckBadgeIcon = memo(({ className }: { className?: string }) => (
	<svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none">
		<path
			d="M10.611 5.9454C10.611 5.2824 11.0706 4.5324 10.8312 3.9564C10.5834 3.3588 9.7188 3.156 9.2688 2.706C8.8182 2.2554 8.616 1.3914 8.0184 1.1436C7.4418 0.9048 6.6918 1.3638 6.0294 1.3638C5.3664 1.3638 4.6164 0.9042 4.0404 1.1436C3.4422 1.3908 3.24 2.2548 2.7894 2.7054C2.3388 3.156 1.4748 3.3582 1.227 3.9558C0.9882 4.5324 1.4472 5.2824 1.4472 5.9448C1.4472 6.6078 0.9876 7.3578 1.227 7.9338C1.4748 8.5314 2.3394 8.7342 2.7894 9.1842C3.24 9.6348 3.4422 10.4988 4.0398 10.7466C4.6164 10.9854 5.3664 10.5264 6.0288 10.5264C6.6918 10.5264 7.4418 10.986 8.0178 10.7466C8.6154 10.4988 8.8182 9.6342 9.2682 9.1842C9.7188 8.7336 10.5828 8.5314 10.8306 7.9338C11.0706 7.3578 10.611 6.6078 10.611 5.9454Z"
			fill="#32C436"
		/>
		<path
			d="M5.604 8.0604C5.4174 8.0604 5.2386 7.9836 5.1102 7.8486L3.921 6.5982C3.6618 6.3252 3.6726 5.8938 3.9456 5.6346C4.2186 5.3754 4.65 5.3862 4.9092 5.6586L5.5902 6.375L7.0992 4.698C7.3512 4.4184 7.782 4.3956 8.0622 4.6476C8.3418 4.8996 8.3646 5.3304 8.1126 5.6106L6.1104 7.8354C6.04752 7.90526 5.97088 7.96137 5.88528 8.00019C5.79968 8.03902 5.70698 8.05972 5.613 8.061C5.61 8.0604 5.607 8.0604 5.604 8.0604Z"
			fill="white"
		/>
	</svg>
))

const ConnectionIcon = memo(({ className }: { className?: string }) => (
	<svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none">
		<path
			d="M10.5 1C10.5 0.723858 10.2761 0.5 10 0.5C9.72386 0.5 9.5 0.723858 9.5 1H10.5ZM10 10H9.5V10.5H10V10ZM10 1H9.5V10H10H10.5V1H10ZM10 10V10.5H19V10V9.5H10V10Z"
			fill="#1C1D23"
			fillOpacity="0.35"
		/>
	</svg>
))

/**
 * ContactsMobilePage - Mobile contacts page component
 * Displays company information, partners, and quick actions
 */
const ContactsMobilePage = observer(() => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const { magicColorScales } = useTheme()
	const navigate = useNavigate()
	const { isPersonalOrganization } = userStore.user

	const organizationCode = userStore.user.organizationCode

	// Get user organization data for displaying department paths
	const { pathNodesState } = useCurrentOrganizationData()
	const { setCurrentDepartmentPath } = useContactPageDataContext()

	const handleDepartmentItemClick = useMemoizedFn((pathNodes: { id: string; name: string }[]) => {
		setCurrentDepartmentPath(pathNodes)
		navigate({
			name: RouteName.ContactsOrganization,
		})
	})

	useEffect(() => {
		return interfaceStore.setEnableGlobalSafeArea({
			// top: false,
			// bottom: false,
		})
	}, [])

	return (
		<>
			<div className={cn(styles.container, "pb-safe-bottom-with-tabbar")}>
				<UserHeader
					center={<div className={styles.title}>{t("sider.mobileTabBar.contacts")}</div>}
				/>
				<div className={styles.content}>
					{/* Company Information Card */}
					{!isPersonalOrganization && (
						<div className={styles.card}>
							<div className={styles.sectionTitle}>
								{t("contacts.subSider.enterpriseInternal")}
							</div>

							<FlexBox gap={8} className={styles.companyInfo}>
								<ComponentRender
									componentName={DefaultComponents.OrganizationAvatarRender}
									size={42}
								/>
								<div className={styles.companyDetails}>
									<div className={styles.companyName}>
										<OrganizationRender organizationCode={organizationCode} />
									</div>
									<div className={styles.mainOrgBadge}>
										<CheckBadgeIcon className={styles.mainOrgIcon} />
										<span className={styles.mainOrgText}>
											{t("contacts.subSider.mainOrganization")}
										</span>
									</div>
								</div>
							</FlexBox>

							<div style={{ marginLeft: 50 }}>
								<div
									className={styles.departmentItem}
									onClick={() => handleDepartmentItemClick([])}
								>
									<ConnectionIcon className={styles.connectionIcon} />
									<span className={styles.departmentText}>
										{t("contacts.subSider.organization")}
									</span>
									<MagicIcon
										component={IconChevronRight}
										className={styles.chevronIcon}
									/>
								</div>

								{/* Display user department paths dynamically */}
								{pathNodesState?.map((node) => (
									<div
										key={node.id}
										className={styles.departmentItem}
										onClick={() => handleDepartmentItemClick(node.pathNodes)}
									>
										<ConnectionIcon className={styles.connectionIcon} />
										<span className={styles.departmentText}>
											{node.departmentPathName}
										</span>
										<MagicIcon
											component={IconChevronRight}
											className={styles.chevronIcon}
										/>
									</div>
								))}
							</div>
						</div>
					)}
					{/* Partners Card */}
					{/* <div className={styles.card}>
		<div className={styles.sectionTitle}>合作伙伴</div>

		<div className={styles.partnerItem}>
			<div className={styles.iconContainer} style={{ backgroundColor: "#32c436" }}>
				<HeartHandshakeIcon className={styles.partnerIcon} />
			</div>
			<span className={styles.itemText}>客户</span>
			<ChevronRightIcon className={styles.chevronIcon} />
		</div>

		<div className={styles.partnerItem}>
			<div className={styles.iconContainer} style={{ backgroundColor: "#32c436" }}>
				<HeartHandshakeIcon className={styles.partnerIcon} />
			</div>
			<span className={styles.itemText}>代理商</span>
			<ChevronRightIcon className={styles.chevronIcon} />
		</div>
	</div> */}
					{/* Quick Actions */}
					<div className={styles.quickActions}>
						<div
							className={styles.quickActionItem}
							onClick={() => navigate({ name: RouteName.ContactsAiAssistant })}
						>
							<div
								className={styles.quickActionIcon}
								style={{ backgroundColor: magicColorScales.brand[5] }}
							>
								<MagicIcon component={IconMagicBots} size={20} color="white" />
							</div>
							<div className={styles.itemText}>
								{t("contacts.subSider.aiAssistant")}
							</div>
							<MagicIcon
								component={IconChevronRight}
								className={styles.chevronIcon}
							/>
						</div>

						{/* <div className={styles.quickActionItem}>
			<div className={styles.quickActionIcon} style={{ backgroundColor: "#ff0974" }}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path
						d="M5 17.5V15.8333C5 14.9493 5.35119 14.1014 5.97631 13.4763C6.60143 12.8512 7.44928 12.5 8.33333 12.5H8.75M6.66667 5.83333C6.66667 6.71739 7.01786 7.56524 7.64298 8.19036C8.2681 8.81548 9.11595 9.16667 10 9.16667C10.8841 9.16667 11.7319 8.81548 12.357 8.19036C12.9821 7.56524 13.3333 6.71739 13.3333 5.83333C13.3333 4.94928 12.9821 4.10143 12.357 3.47631C11.7319 2.85119 10.8841 2.5 10 2.5C9.11595 2.5 8.2681 2.85119 7.64298 3.47631C7.01786 4.10143 6.66667 4.94928 6.66667 5.83333ZM14.8335 17.3475L13.0235 18.2958C12.9698 18.3238 12.9094 18.3362 12.849 18.3318C12.7886 18.3275 12.7306 18.3064 12.6815 18.2709C12.6324 18.2355 12.5941 18.1871 12.571 18.1311C12.5478 18.0752 12.5406 18.0139 12.5502 17.9541L12.896 15.945L11.4319 14.5225C11.3882 14.4802 11.3572 14.4265 11.3426 14.3676C11.3279 14.3086 11.3301 14.2466 11.349 14.1889C11.3679 14.1311 11.4026 14.0797 11.4492 14.0408C11.4958 14.0018 11.5525 13.9767 11.6127 13.9683L13.636 13.675L14.541 11.8475C14.5681 11.793 14.6098 11.7473 14.6615 11.7152C14.7132 11.6832 14.7727 11.6663 14.8335 11.6663C14.8943 11.6663 14.9539 11.6832 15.0056 11.7152C15.0573 11.7473 15.099 11.793 15.126 11.8475L16.031 13.675L18.0544 13.9683C18.1144 13.9769 18.1708 14.0022 18.2172 14.0412C18.2637 14.0803 18.2982 14.1315 18.3171 14.1892C18.3359 14.2468 18.3382 14.3086 18.3237 14.3675C18.3092 14.4264 18.2786 14.4801 18.2352 14.5225L16.771 15.945L17.116 17.9533C17.1264 18.0132 17.1197 18.0748 17.0968 18.1311C17.074 18.1874 17.0357 18.2362 16.9865 18.2718C16.9373 18.3075 16.8791 18.3286 16.8185 18.3329C16.7578 18.3371 16.6972 18.3243 16.6435 18.2958L14.8335 17.3475Z"
						stroke="white"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
			<div className={styles.itemText}>关注的人</div>
			<ChevronRightIcon className={styles.chevronIcon} />
		</div> */}

						{!isPersonalOrganization && (
							<div
								className={styles.quickActionItem}
								onClick={() => navigate({ name: RouteName.ContactsMyGroups })}
							>
								<div
									className={styles.quickActionIcon}
									style={{ backgroundColor: magicColorScales.lightGreen[5] }}
								>
									<MagicIcon component={IconUsers} size={20} color="white" />
								</div>
								<div className={styles.itemText}>
									{t("contacts.subSider.myGroups")}
								</div>
								<MagicIcon
									component={IconChevronRight}
									className={styles.chevronIcon}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	)
})

ContactsMobilePage.displayName = "ContactsMobilePage"

export default ContactsMobilePage
