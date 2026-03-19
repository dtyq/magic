import MagicIcon from "@/components/base/MagicIcon"
import { useSwitchOrganization } from "@/hooks/account/useSwitchOrganization"
import { User } from "@/types/user"
import { IconCheck } from "@tabler/icons-react"
import { Flex } from "antd"
import { observer } from "mobx-react-lite"
import { useOrganizationListStyles } from "./styles"
import MagicAvatar from "@/components/base/MagicAvatar"
import Department from "./icons/Department"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useTheme } from "antd-style"
import PersonalOrganizationAvatar from "@/assets/resources/personal-organization-avatar.svg"
import { useTranslation } from "react-i18next"
import useCancelRecord from "@/components/business/RecordingSummary/hooks/useCancelRecord"
import { logger as Logger } from "@/utils/log"

export interface OrganizationItemProps {
	disabled: boolean
	isSelected: boolean
	onClick?: () => void
	account: User.UserAccount
	organization?: User.MagicOrganization
	thirdPlatformOrganization?: User.UserOrganization
	onSwitchAfter?: () => void
	onSwitchBefore?: () => void
}

const logger = Logger.createLogger("OrganizationItem")

const OrganizationItem = observer((props: OrganizationItemProps) => {
	const {
		disabled: disabledProps,
		organization,
		account,
		onClick,
		onSwitchAfter,
		isSelected,
		thirdPlatformOrganization,
		onSwitchBefore,
	} = props
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")

	const { magicColorScales } = useTheme()

	const disabled = useMemo(() => {
		return disabledProps || !organization
	}, [disabledProps, organization])

	const { styles, cx } = useOrganizationListStyles()

	const organizationName = useMemo(() => {
		return (
			thirdPlatformOrganization?.organization_name ||
			organization?.magic_organization_code ||
			thirdPlatformOrganization?.organization_code
		)
	}, [thirdPlatformOrganization, organization?.magic_organization_code])

	const avatarUrl = useMemo(() => {
		return (
			thirdPlatformOrganization?.organization_logo?.[0]?.url ||
			organization?.organization_logo
		)
	}, [thirdPlatformOrganization, organization?.organization_logo])

	const switchOrganization = useSwitchOrganization({
		disabled,
		onSwitchAfter,
		onSwitchBefore,
	})

	const { cancelRecord } = useCancelRecord({
		noNeedButtonText: tSuper("recordingSummary.cancelModal.noNeedWithContinue"),
		summarizeButtonText: tSuper("recordingSummary.cancelModal.summarizeWithContinue"),
		modalContent: tSuper("recordingSummary.cancelModal.messageWithContinue"),
		aiRecordingModalContent: tSuper("recordingSummary.aiRecordingModal.switchContent"),
		aiRecordingConfirmText: tSuper("recordingSummary.aiRecordingModal.switchConfirmText"),
	})

	const handleClick = useMemoizedFn(async () => {
		try {
			// 用户点击组织时，如果正在录音，则先取消录音
			await cancelRecord()

			if (onClick) {
				onClick()
				return
			}

			if (organization) {
				switchOrganization(account, organization)
			}
		} catch (error) {
			logger.error("switch organization failed", error)
		}
	})

	const currentOrganizationInfo = useMemo(() => {
		return account.teamshareOrganizations.find(
			(_organization) =>
				_organization.organization_code === organization?.third_platform_organization_code,
		)
	}, [account, organization])

	return (
		<div
			key={organization?.magic_organization_code}
			onClick={handleClick}
			className={cx(styles.item, {
				[styles.itemDisabled]: !organization,
				[styles.itemSelected]: isSelected,
			})}
		>
			<div className={styles.itemIcon}>
				<MagicAvatar
					src={
						currentOrganizationInfo?.is_personal_organization
							? PersonalOrganizationAvatar
							: avatarUrl || <Department />
					}
					size={30}
					className={cx(styles.avatar, {
						[styles.avatarDisabled]: disabled,
					})}
				>
					{organizationName}
				</MagicAvatar>
			</div>
			<div className={styles.itemText}>
				{currentOrganizationInfo?.is_personal_organization
					? t("personalVersion")
					: organizationName}
			</div>
			<Flex>
				{/* {isSelected ? (
					<MagicIcon
						color={magicColorScales.brand[5]}
						size={20}
						stroke={2}
						component={IconCheck}
					/>
				) : // 如果 organization 为空，则不显示 badge
				organization?.magic_organization_code ? (
					<Badge
						count={
							unreadDotsGroupByOrganization?.[organization.magic_organization_code]
						}
					/>
				) : null} */}
				{isSelected ? (
					<MagicIcon
						color={magicColorScales.brand[5]}
						size={20}
						stroke={2}
						component={IconCheck}
					/>
				) : null}
			</Flex>
		</div>
	)
})

export default OrganizationItem
