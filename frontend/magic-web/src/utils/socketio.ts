import { userStore } from "@/models/user"
import { SocketIoPacketType, EngineIoPacketType } from "@/constants/socketio"
import type { Packet } from "socket.io-parser"
import { Decoder } from "socket.io-parser"
import { configStore } from "@/models/config"
import { getCurrentLang, normalizeLocale } from "./locale"

export const decoder = new Decoder()

export function decodeSocketIoMessage(data: string) {
	return new Promise<Packet>((resolve) => {
		decoder.on("decoded", (packet) => {
			resolve(packet)
		})

		decoder.add(data)
	})
}

/**
 * 自定义 payload 数据
 * @param data 数据
 * @returns payload 数据
 */
function genPayload(data: unknown, context: Record<string, unknown> = {}) {
	const { organizationCode } = userStore.user
	return {
		context: {
			// request_id: nanoid(),
			timestamp: Date.now(),
			authorization: userStore.user.authorization ?? "",
			organization_code: organizationCode ?? "",
			language: getCurrentLang(normalizeLocale(configStore.i18n.displayLanguage)),
			// 可能后续用于消息的加密解密
			signature: "",
			...context,
		},
		data,
	}
}

/**
 * 包装 Websocket 消息
 * @param type Websocket 事件类型
 * @param data JSON 数据
 * @param ackId ACK ID
 * @param context 上下文
 * @param socketioPacketType SocketIo 数据包类型
 * @param nsp 命名空间
 * @param engineioPackType EngineIo 数据包类型
 * @returns 数据包
 */
export const encodeSocketIoMessage = (
	type: string,
	data: unknown,
	ackId: number = 1,
	context: Record<string, unknown> = {},
	socketioPacketType: SocketIoPacketType = SocketIoPacketType.EVENT,
	nsp: string = "/im",
	engineioPackType: EngineIoPacketType = EngineIoPacketType.MESSAGE,
) => {
	// Socket.IO 数据包结构
	// <packet type>[<# of binary attachments>-][<namespace>,][<acknowledgment id>][JSON-stringified payload without binary]
	// 每个 Socket.IO 数据包都包装在 Engine.IO 消息数据包中，因此在通过线路发送时，它们将以字符“4”为前缀。
	// More Info: https://github.com/socketio/socket.io-protocol?tab=readme-ov-file#sending-and-receiving-data-1
	const namespace = nsp ? `${nsp},` : ""
	const payload = genPayload(data, context)

	// @ts-ignore

	// console.log(
	// 	"%c 发送消息: ",
	// 	"background-color: yellow; color: #000;",
	// 	payload?.data?.message?.type,
	// 	payload,
	// )

	return `${engineioPackType}${socketioPacketType}${namespace}${ackId}${JSON.stringify([type, payload])}`
}
