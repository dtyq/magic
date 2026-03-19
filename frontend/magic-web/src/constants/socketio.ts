/**
 * Socket.IO Protocol Packet Type
 * https://github.com/socketio/socket.io-protocol/tree/main
 */
export const enum SocketIoPacketType {
	CONNECT = 0,
	DISCONNECT = 1,
	EVENT = 2,
	ACK = 3,
	CONNECT_ERROR = 4,
	BINARY_EVENT = 5,
	BINARY_ACK = 6,
}

/**
 * Engine.IO Protocol Packet Type v3
 * https://github.com/socketio/engine.io-protocol/tree/v3
 */
export const enum EngineIoPacketType {
	OPEN = "0",
	CLOSE = "1",
	PING = "2",
	PONG = "3",
	MESSAGE = "4",
	UPGRADE = "5",
	NOOP = "6",
}
