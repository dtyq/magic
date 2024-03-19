import { observer } from "mobx-react-lite"
import FlexBox from "@/opensource/components/base/FlexBox"
import DepartmentRender from "@/opensource/components/business/DepartmentRender"
import { getUserJobTitle, getUserName } from "@/opensource/utils/modules/chat"
import UserInfoStore from "@/opensource/stores/userInfo"
import type { BaseHeaderProps } from "../types"

const UserHeader = observer(
	({
		receiveId: conversationId,
		headerTitleClass,
		headerSubTitleClass,
		className,
	}: BaseHeaderProps) => {
		const userInfo = UserInfoStore.get(conversationId)
		const userName = getUserName(userInfo)
		const userJobTitle = getUserJobTitle(userInfo)

		return (
			<FlexBox vertical className={className}>
				<div className={headerTitleClass}>{userName}</div>
				<div className={headerSubTitleClass}>
					<DepartmentRender path={userInfo?.path_nodes?.[0]?.path} />
					{userJobTitle && ` | ${userJobTitle}`}
				</div>
			</FlexBox>
		)
	},
)

export default UserHeader
