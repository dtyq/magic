import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconUserCog } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount } from "ahooks"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useState } from "react"
import type { StructureUserItem } from "@/opensource/types/organization"
import { hasEditRight } from "@/opensource/pages/flow/components/AuthControlButton/types"
import { FlowRouteType } from "@/opensource/types/flow"
import { observer } from "mobx-react-lite"
import UserPopoverContent from "./user"
import { isUndefined } from "lodash-es"
import userInfoService from "@/opensource/services/userInfo"
import { RouteName } from "@/opensource/routes/constants"
import chatMenuStore from "@/opensource/stores/chatNew/chatMenu"

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
