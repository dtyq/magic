/**
 * Protocol utilities for voice client communication
 * Handles binary protocol operations for volcano ASR service
 */

export const PROTOCOL_CONSTANTS = {
	VERSION: 0x01,
	DEFAULT_HEADER_SIZE: 0x01,
	FULL_CLIENT_REQUEST: 0x01,
	AUDIO_ONLY_REQUEST: 0x02,
	FULL_SERVER_RESPONSE: 0x09,
	SERVER_ACK: 0x0b,
	SERVER_ERROR_RESPONSE: 0x0f,
	POS_SEQUENCE: 0x01,
	NEG_WITH_SEQUENCE: 0x03,
	JSON: 0x01,
	GZIP: 0x01,
	NO_COMPRESSION: 0x00,
	CONNECTION_TIMEOUT: 10000,
	HEARTBEAT_INTERVAL: 30000,
	MIN_MESSAGE_SIZE: 12,
} as const

/**
 * Create protocol header for volcano ASR service
 */
export function createProtocolHeader(
	messageType: number,
	messageFlags: number,
	serialization: number,
	compression: number,
): ArrayBuffer {
	const header = new ArrayBuffer(4)
	const view = new DataView(header)

	view.setUint8(0, (PROTOCOL_CONSTANTS.VERSION << 4) | PROTOCOL_CONSTANTS.DEFAULT_HEADER_SIZE)
	view.setUint8(1, (messageType << 4) | messageFlags)
	view.setUint8(2, (serialization << 4) | compression)
	view.setUint8(3, 0)

	return header
}

/**
 * Package message with header, sequence and payload
 */
export function packageMessage(
	header: ArrayBuffer,
	sequence: number,
	payload: ArrayBuffer,
): ArrayBuffer {
	const messageBody = new ArrayBuffer(header.byteLength + 4 + 4 + payload.byteLength)
	const view = new DataView(messageBody)

	new Uint8Array(messageBody).set(new Uint8Array(header), 0)
	view.setInt32(4, sequence, false)
	view.setUint32(8, payload.byteLength, false)
	new Uint8Array(messageBody).set(new Uint8Array(payload), 12)

	return messageBody
}

/**
 * Parse message header to extract type and sequence
 */
export function parseMessageHeader(buffer: ArrayBuffer): { messageType: number; sequence: number } {
	const view = new DataView(buffer)
	const messageType = (view.getUint8(1) >> 4) & 0x0f
	const sequence = view.getInt32(4, false)
	return { messageType, sequence }
}

/**
 * Extract payload from message buffer
 */
export function extractPayload(data: ArrayBuffer): ArrayBuffer {
	const dataView = new DataView(data)
	const payloadSize = dataView.getUint32(8, false)
	return data.slice(12, 12 + payloadSize)
}

/**
 * Build WebSocket URL with authentication parameters
 */
export function buildWsUrl(
	baseUrl: string,
	resourceId: string,
	apiAppId: string,
	authToken: string,
	connectId: string,
): string {
	const wsUrl = new URL(baseUrl)
	wsUrl.searchParams.set("api_resource_id", resourceId)
	wsUrl.searchParams.set("api_app_key", apiAppId)
	wsUrl.searchParams.set("api_access_key", `Jwt;${authToken}`)
	wsUrl.searchParams.set("api_connect_id", connectId)
	return wsUrl.toString()
}
