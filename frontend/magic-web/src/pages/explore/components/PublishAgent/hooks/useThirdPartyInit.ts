import type { Bot } from "@/types/bot"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import type { FormInstance } from "antd"
import { BotApi } from "@/apis"
import type { PublishAgentType } from ".."

type UseThirdPartyInitProps = {
	agent?: Bot.Detail
	form: FormInstance<PublishAgentType>
	open: boolean
}

export default function useThirdPartyInit({ agent, form, open }: UseThirdPartyInitProps) {
	const initThirdPartyPlatforms = useMemoizedFn(async () => {
		if (!agent?.botEntity?.id) return
		const data = await BotApi.getThirdPartyPlatforms(agent.botEntity.id)
		if (data?.list?.length) {
			form.setFieldsValue({ third_platform_list: data.list })
		}
	})

	useMount(() => {
		initThirdPartyPlatforms()
	})

	useUpdateEffect(() => {
		if (open) {
			initThirdPartyPlatforms()
		}
	}, [open])
}
