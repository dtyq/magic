import { UrlUtils as HttpUrlUtils } from "@/infrastructure/network/http/serialization"
export {
	ResponseParseError,
	type ResponseParseOptions,
} from "@/infrastructure/network/http/serialization"

/** Compatibility URL entry; the WebSocket helper remains in apis. */
export class UrlUtils extends HttpUrlUtils {
	/**
	 * Converts a WebSocket connection URL to a Socket.IO connection URL.
	 * @param url The WebSocket connection URL
	 * @returns The Socket.IO connection URL
	 */
	static transformToSocketIoUrl(url: string) {
		return `${url}/socket.io/?EIO=3&transport=websocket&timestamp=${Date.now()}`
		// An invalid WebSocket URL for debugging the reconnection mechanism.
		// return `wss://192.0.2.1/test`
	}
}

export { StringUtils } from "@/infrastructure/network/http/requestId"
