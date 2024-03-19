export const enum WebSocketReadyState {
	/** 正在连接中 */
	CONNECTING = 0,
	/** 连接成功 */
	OPEN = 1,
	/** 正在关闭中 */
	CLOSING = 2,
	/** 连接已关闭 */
	CLOSED = 3,
}
export type WebSocketMessage = string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView
export interface SendResponse<D> {
	id: number | undefined
	data: D
}
