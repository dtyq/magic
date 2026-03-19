import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconUserCog } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount } from "ahooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { useState } from "react"
import type { StructureUserItem } from "@/types/organization"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { FlowRouteType } from "@/types/flow"
import { observer } from "mobx-react-lite"
import UserPopoverContent from "./user"
import { isUndefined } from "lodash-es"
import userInfoService from "@/services/userInfo"
import { RouteName } from "@/routes/constants"
import chatMenuStore from "@/stores/chatNew/chatMenu"

interface AiPopoverContentProps {
	receiveId: string
	conversationId: string
}

const AiPopoverContent = observer(({ receiveId, conversationId }: AiPopoverContentProps) => {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()
	const [ai, setAI] = useState<StructureUserItem>()

	useMount(() => {
		userInfoService.fetchUserInfos([receiveId], 1).then((res) => {
			setAI(res?.[0])
		})
	})

	const navigateToWorkflow = useMemoizedFn(async () => {
		navigate({
			name: RouteName.FlowDetail,
			params: {
				id: ai?.bot_info?.bot_id || "",
				type: FlowRouteType.Agent,
			},
		})
		chatMenuStore.closeMenu()
	})

	return (
		<>
			{/* <PraiseButton /> */}
			{/* FIXME: 等后端接口改造后，bot_info 字段名改为 agent_info */}
			{!isUndefined(ai?.bot_info?.user_operation) &&
				hasEditRight(ai?.bot_info?.user_operation) && (
					<MagicButton
						justify="flex-start"
						icon={<MagicIcon component={IconUserCog} size={20} />}
						size="large"
						type="text"
						block
						onClick={navigateToWorkflow}
					>
						{t("chat.floatButton.aiAssistantConfiguration")}
					</MagicButton>
				)}
			{/* <div style={{ height: 1, background: colorUsages.border }} /> */}
			<UserPopoverContent conversationId={conversationId} />
		</>
	)
})

export default AiPopoverContent
