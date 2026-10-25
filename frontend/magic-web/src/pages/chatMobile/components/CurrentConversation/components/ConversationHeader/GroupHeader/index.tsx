import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import FlexBox from "@/components/base/FlexBox"
import OrganizationRender from "@/components/business/OrganizationRender"
import GroupInfoStore from "@/stores/groupInfo"
import type { BaseHeaderProps } from "../types"

const GroupHeader = observer(
	({
		receiveId: conversationId,
		headerTitleClass,
		headerSubTitleClass,
		className,
	}: BaseHeaderProps) => {
		const { t } = useTranslation("chat")
		const groupInfo = GroupInfoStore.get(conversationId)

		return (
			<FlexBox vertical className={className}>
				<div className={headerTitleClass}>{groupInfo?.group_name}</div>
				<div className={headerSubTitleClass}>
					{t("group.belongsTo")}{" "}
					<OrganizationRender organizationCode={groupInfo?.organization_code} />
				</div>
			</FlexBox>
		)
	},
)

export default GroupHeader
