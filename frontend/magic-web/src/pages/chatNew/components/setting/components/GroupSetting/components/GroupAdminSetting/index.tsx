import { Flex } from "antd"
import type { Conversation } from "@/types/chat/conversation"

interface GroupAdminSettingProps {
	conversation: Conversation
}

const GroupAdminSetting = ({ conversation }: GroupAdminSettingProps) => {
	console.log("conversation", conversation)

	return <Flex>111</Flex>
}

export default GroupAdminSetting
