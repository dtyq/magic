export enum TriggerType {
	// 发送新消息时
	Message = 1,
	// 聊天窗口打开时
	NewChat = 2,
	// 定时触发
	TimeTrigger = 3,
	// 参数调用
	Arguments = 4,
	// 循环起始
	LoopStart = 5,
	// 添加为好友时
	NewFriends = 7,
}

// 触发类型选项
export const TriggerTypeOptions = [
	{
		label: "发送新消息时",
		value: TriggerType.Message,
	},
	{
		label: "聊天窗口打开时",
		value: TriggerType.NewChat,
	},
]

export default {}
