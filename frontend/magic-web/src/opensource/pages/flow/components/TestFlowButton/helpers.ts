import type { User } from "@/opensource/types/user"
import dayjs from "@/opensource/lib/dayjs"
import { nanoid } from "nanoid"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import { TriggerType } from "../../nodes/Start/v0/constants"
import type { DynamicFormItem } from "./hooks/useArguments"

export const getDefaultTestArgs = (type: TriggerType, user: User.UserInfo) => {
	if (type === TriggerType.NewChat) {
		return {
			trigger_type: TriggerType.NewChat,
			trigger_data: {
				chat_time: dayjs("00:00:00", "HH:mm:ss"),
			},
		}
	}
	return {
		trigger_type: TriggerType.Message,
		conversation_id: nanoid(8),
		trigger_data: {
			nickname: user?.nickname,
			message_type: ConversationMessageType.Text,
			content: "默认消息内容",
			// @ts-ignore
			chat_time: dayjs("00:00:00", "HH:mm:ss"),
		},
	}
}

/**
 * 将schema转为动态的form item项
 * @param schema JSON schema
 */
export const transformSchemaToDynamicFormItem = (schema: Schema): DynamicFormItem[] => {
	const result = [] as DynamicFormItem[]
	Object.entries(schema?.properties || {}).forEach(([key, subSchema]) => {
		const resultItem = {
			label: subSchema?.title || key,
			type: subSchema.type,
			key,
			required: schema?.required?.includes?.(key) || false,
		}
		// TODO Array类型和Object类型的生成
		result.push(resultItem)
	})

	return result
}

export default {}
