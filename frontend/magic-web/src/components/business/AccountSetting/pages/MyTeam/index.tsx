import { memo, useState } from "react"
import { useMount } from "ahooks"
import { Empty, Spin } from "antd"
import { useTranslation } from "react-i18next"
import { ContactApi } from "@/apis"
import type { MyOrganization } from "@/types/contact"
import magicToast from "@/components/base/MagicToaster/utils"
import { userStore } from "@/models/user"
import OrganizationCard from "./components/OrganizationCard"
import { useStyles } from "./styles"

function MyTeamPage() {
	const { styles } = useStyles()
	const { t } = useTranslation("accountSetting")
	const [isLoading, setIsLoading] = useState(false)
	const [organizations, setOrganizations] = useState<MyOrganization[]>([])

	useMount(() => {
		loadOrganizations()
	})

	async function loadOrganizations() {
		try {
			setIsLoading(true)
			const response = await ContactApi.getMyOrganizations()
			setOrganizations(
				response.items
					.map((item) => ({
						...item,
						is_current:
							item.magic_organization_code ===
							userStore.user.userInfo?.organization_code,
					}))
					.sort((firstItem, secondItem) => {
						if (firstItem.is_current) return -1
						if (secondItem.is_current) return 1
						return 0
					}),
			)
		} catch (error) {
			magicToast.error(t("common:loadFailed"))
		} finally {
			setIsLoading(false)
		}
	}

	if (isLoading) {
		return (
			<div className={styles.loading} data-testid="account-setting-my-team-loading">
				<Spin />
			</div>
		)
	}

	if (organizations.length === 0) {
		return (
			<div className={styles.empty} data-testid="account-setting-my-team-empty">
				<Empty description={t("noData")} />
			</div>
		)
	}

	return (
		<div className={styles.container} data-testid="account-setting-my-team-page">
			{organizations.map((organization) => (
				<OrganizationCard
					key={organization.magic_organization_code}
					organization={organization}
				/>
			))}
		</div>
	)
}

export default memo(MyTeamPage)
