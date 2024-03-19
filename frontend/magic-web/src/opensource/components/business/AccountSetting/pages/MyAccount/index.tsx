import { memo } from "react"
import { userStore } from "@/opensource/models/user"
import { useStyles } from "./styles"
import DepartmentCard from "./components/DepartmentCard"
import PointsCard from "./components/PointsCard"
import SubscriptionCard from "./components/SubscriptionCard"
import UserInfoCard from "./components/UserInfoCard"

export function MyAccountPage() {
	const { styles } = useStyles()
	const { isPersonalOrganization } = userStore.user

	return (
		<div className={styles.container} data-testid="account-setting-my-account-page">
			<UserInfoCard />
			{!isPersonalOrganization ? <DepartmentCard /> : null}
			<SubscriptionCard />
			<PointsCard />
		</div>
	)
}

export default memo(MyAccountPage)
