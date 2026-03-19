import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { Bot } from "@/types/bot"
import MagicButton from "@/components/base/MagicButton"
import PublishAgent from "@/pages/explore/components/PublishAgent"
import type { MutableRefObject } from "react"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"

type PublishAgentButtonProps = {
	agent: Bot.Detail
	setAgent: React.Dispatch<React.SetStateAction<Bot.Detail>>
	flowInstance: MutableRefObject<MagicFlowInstance | null>
	initPublishList?: (this: any, agentId: any) => Promise<void>
}

export default function PublishAgentButton({
	agent,
	setAgent,
	flowInstance,
	initPublishList,
}: PublishAgentButtonProps) {
	const { t } = useTranslation("interface")

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const updateAgent = useMemoizedFn((scope: number, version: string) => {
		const newBotVersion = agent?.botVersionEntity || { release_scope: "", version_number: "" }
		newBotVersion.release_scope = scope
		newBotVersion.version_number = version
		setAgent({
			...agent,
			botVersionEntity: newBotVersion,
		})
	})

	const close = useMemoizedFn((scope: number, version: string) => {
		updateAgent(scope, version)
		setFalse()
	})

	return (
		<>
			<MagicButton type="primary" onClick={setTrue}>
				{t("button.publish")}
			</MagicButton>
			<PublishAgent
				agentId={agent.botEntity?.id}
				scope={agent.botVersionEntity?.release_scope}
				open={open}
				submit={initPublishList}
				close={close}
				flowInstance={flowInstance}
				agent={agent}
				updateAgent={updateAgent}
			/>
		</>
	)
}
