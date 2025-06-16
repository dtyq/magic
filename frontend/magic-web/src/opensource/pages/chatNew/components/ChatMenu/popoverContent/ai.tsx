import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconUserCog } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { RoutePath } from "@/const/routes"
import { useMemoizedFn, useMount } from "ahooks"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { replaceRouteParams } from "@/utils/route"
import { useState } from "react"
import type { StructureUserItem } from "@/types/organization"
import { hasEditRight } from "@/opensource/pages/flow/components/AuthControlButton/types"
import { FlowRouteType } from "@/types/flow"
import { observer } from "mobx-react-lite"
import UserPopoverContent from "./user"
import { isUndefined } from "lodash-es"
import userInfoService from "@/opensource/services/userInfo"

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
		navigate(
			replaceRouteParams(RoutePath.FlowDetail, {
				id: ai?.agent_info?.bot_id || "",
				type: FlowRouteType.Agent,
			}),
		)
	})

	return (
		<>
			{/* <PraiseButton /> */}
			{!isUndefined(ai?.agent_info?.user_operation) &&
				hasEditRight(ai?.agent_info?.user_operation) && (
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
