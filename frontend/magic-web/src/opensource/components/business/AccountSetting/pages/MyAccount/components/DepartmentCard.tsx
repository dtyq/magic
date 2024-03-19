import { memo, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import DepartmentRender from "@/opensource/components/business/DepartmentRender"
import type { StructureUserItem } from "@/opensource/types/organization"
import { useCurrentMagicOrganization } from "@/opensource/models/user/hooks"
import { userStore } from "@/opensource/models/user"
import userInfoService from "@/opensource/services/userInfo"
import { useStyles } from "../styles"
import OrganizationAvatarRender from "@/opensource/components/business/OrganizationAvatarRender"

const DepartmentCard = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("accountSetting")
	const { t: tInterface } = useTranslation("interface")
	const organization = useCurrentMagicOrganization()
	const { userInfo: basicUserInfo } = userStore.user
	const [userInfo, setUserInfo] = useState<StructureUserItem | null>(null)
	const [showPhone, setShowPhone] = useState(false)

	useEffect(() => {
		if (!basicUserInfo?.user_id) return

		userInfoService
			.fetchUserInfos([basicUserInfo.user_id], 2)
			.then((response: StructureUserItem[]) => {
				const target = response[0]

				if (target?.path_nodes?.length) {
					target.path_nodes = target.path_nodes.filter((node) => node.path !== "-1")
				}

				setUserInfo(target || null)
			})
			.catch((error) => {
				console.error("Failed to fetch user info:", error)
			})
	}, [basicUserInfo?.user_id])

	function maskPhone(phone?: string) {
		if (!phone) return ""
		return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
	}

	function formatPhone(phone?: string, countryCode?: string) {
		if (!phone) return ""
		const code = countryCode || userInfo?.country_code || "+86"
		return `${code} ${phone}`
	}

	function handleTogglePhone() {
		setShowPhone(!showPhone)
	}

	const displayPhone = showPhone
		? formatPhone(userInfo?.phone, userInfo?.country_code)
		: formatPhone(maskPhone(userInfo?.phone), userInfo?.country_code)

	return (
		<div className={styles.card} data-testid="account-setting-department-card">
			{organization ? (
				<div className={styles.departmentHeader}>
					<OrganizationAvatarRender size={24} />
					<div className={styles.organizationName}>
						{organization.organization_name || t("organization")}
					</div>
				</div>
			) : null}

			<div className={styles.departmentContent}>
				<div className={styles.departmentLabels}>
					<div className={styles.departmentLabel}>{tInterface("setting.realName")}</div>
					{userInfo?.path_nodes?.length
						? userInfo.path_nodes.map((_, index) => (
								<div key={index} className={styles.departmentLabel}>
									{t("department")}
								</div>
							))
						: null}
					{userInfo?.phone ? (
						<div className={styles.departmentLabel}>
							{tInterface("setting.phoneNumber")}
						</div>
					) : null}
				</div>

				<div className={styles.departmentValues}>
					<div className={styles.departmentValue}>{userInfo?.real_name || "-"}</div>
					{userInfo?.path_nodes?.length
						? userInfo.path_nodes.map((node, index) => (
								<div key={index} className={styles.departmentValue}>
									<DepartmentRender
										path={node.path}
										separator=" / "
										allowNavigate={false}
									/>
								</div>
							))
						: null}
					{userInfo?.phone ? (
						<div className={styles.departmentPhoneRow}>
							<span className={styles.departmentValue}>{displayPhone}</span>
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
})

export default memo(DepartmentCard)
