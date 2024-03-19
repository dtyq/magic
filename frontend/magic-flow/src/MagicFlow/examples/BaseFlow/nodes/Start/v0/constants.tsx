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
}
