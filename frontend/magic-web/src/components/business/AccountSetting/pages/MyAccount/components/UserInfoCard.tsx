import { memo, useState } from "react"
import { useMount } from "ahooks"
import { observer } from "mobx-react-lite"
import { IconDeviceMobile, IconLogout, IconMail, IconUserCog } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { FlexBox } from "@/components/base"
import useLogout from "@/hooks/account/useLogout"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useUserInfo } from "@/models/user/hooks"
import SettingService from "@/services/setting"
import SettingStore from "@/stores/setting"
import { useStyles } from "../styles"
import EditProfileModal from "./EditProfileModal"
import MagicIdDisplay from "./MagicIdDisplay"
import UserAvatarRender from "@/components/business/UserAvatarRender"

const UserInfoCard = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("accountSetting")
	const { userInfo } = useUserInfo()
	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
	const { canUpdateUserInfo } = SettingStore
	const isMobile = useIsMobile()

	useMount(() => {
		SettingService.getUpdateUserInfoPermission()
	})

	const handleLogout = useLogout()

	function openEditProfile() {
		setIsEditProfileOpen(true)
	}

	function closeEditProfile() {
		setIsEditProfileOpen(false)
	}

	function maskPhone(phone?: string) {
		if (!phone) return "-"
		return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
	}

	return (
		<div className={styles.card} data-testid="account-setting-user-info-card">
			<div
				className={styles.userInfoCard}
				style={isMobile ? { flexDirection: "column" } : undefined}
			>
				<div className={styles.userInfoLeft}>
					<UserAvatarRender className="rounded-lg" userInfo={userInfo} size={64} />
					<div className={styles.userInfoMain}>
						<FlexBox vertical gap={3} className={styles.userName}>
							{userInfo?.nickname || userInfo?.magic_id}
							{userInfo?.magic_id ? (
								<MagicIdDisplay magicId={userInfo.magic_id} />
							) : null}
						</FlexBox>
						<div className={styles.userContactInfo}>
							<div className={styles.contactItem}>
								<div className={styles.contactDetail}>
									<div className={styles.contactIcon}>
										<IconDeviceMobile size={16} />
									</div>
									<div className={styles.contactText}>
										{maskPhone(userInfo?.phone)}
									</div>
								</div>
							</div>
							{userInfo?.email ? (
								<div className={styles.contactItem}>
									<div className={styles.contactDetail}>
										<div className={styles.contactIcon}>
											<IconMail size={16} />
										</div>
										<div className={styles.contactText}>{userInfo.email}</div>
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>
				<div className={styles.userInfoRight}>
					{canUpdateUserInfo ? (
						<>
							<div
								className={`${styles.actionButton} ${styles.editButton}`}
								onClick={openEditProfile}
								data-testid="account-setting-edit-profile-button"
							>
								<IconUserCog size={20} />
								<span>{t("editProfile")}</span>
							</div>
							<EditProfileModal open={isEditProfileOpen} onClose={closeEditProfile} />
						</>
					) : null}
					<div
						className={`${styles.actionButton} ${styles.logoutButton}`}
						onClick={() => handleLogout()}
						data-testid="account-setting-logout-button"
					>
						<IconLogout size={20} />
						<span>{t("logout")}</span>
					</div>
				</div>
			</div>
		</div>
	)
})

export default memo(UserInfoCard)
