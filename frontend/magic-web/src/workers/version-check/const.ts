// SharedWorker接收到MessageType类型事件后，处理后对应的事件返回，以reflect开头
export enum ReflectMessageType {
	REFLECT_GET_LATEST_VERSION = "reflectGetLatestVersion",
	REFLECT_REFRESH = "reflectRefresh",
}

// 发送消息的类型
export enum MessageType {
	START = "start", // 开启轮询，检测Etag版本
	STOP = "stop", // 停止轮询
	CLOSE = "close", // 关闭或刷新页面时，关闭SharedWorker的端口
	REFRESH = "refresh",
}
