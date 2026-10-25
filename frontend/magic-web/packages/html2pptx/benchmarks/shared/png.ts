import { deflateSync } from "node:zlib"

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const CRC_TABLE = createCrcTable()

export function createNoisePngBuffer(width: number, height: number, seed: number): Buffer {
	if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
		throw new Error("PNG dimensions must be positive integers")
	}

	const scanlines = Buffer.allocUnsafe(height * (1 + width * 4))
	let state = normalizeSeed(seed)
	let offset = 0
	for (let y = 0; y < height; y++) {
		scanlines[offset++] = 0
		for (let x = 0; x < width; x++) {
			state = xorshift32(state)
			scanlines[offset++] = state & 0xff
			scanlines[offset++] = (state >>> 8) & 0xff
			scanlines[offset++] = (state >>> 16) & 0xff
			scanlines[offset++] = 0xff
		}
	}

	const ihdr = Buffer.alloc(13)
	ihdr.writeUInt32BE(width, 0)
	ihdr.writeUInt32BE(height, 4)
	ihdr[8] = 8
	ihdr[9] = 6
	ihdr[10] = 0
	ihdr[11] = 0
	ihdr[12] = 0

	return Buffer.concat([
		PNG_SIGNATURE,
		createChunk("IHDR", ihdr),
		createChunk("IDAT", deflateSync(scanlines, { level: 0 })),
		createChunk("IEND", Buffer.alloc(0)),
	])
}

export function createNoisePngDataUrl(width: number, height: number, seed: number): string {
	return `data:image/png;base64,${createNoisePngBuffer(width, height, seed).toString("base64")}`
}

function createChunk(type: string, data: Buffer): Buffer {
	const typeBytes = Buffer.from(type, "ascii")
	const chunk = Buffer.allocUnsafe(12 + data.length)
	chunk.writeUInt32BE(data.length, 0)
	typeBytes.copy(chunk, 4)
	data.copy(chunk, 8)
	chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length)
	return chunk
}

function createCrcTable(): Uint32Array {
	const table = new Uint32Array(256)
	for (let index = 0; index < 256; index++) {
		let value = index
		for (let bit = 0; bit < 8; bit++) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
		}
		table[index] = value >>> 0
	}
	return table
}

function crc32(buffer: Buffer): number {
	let crc = 0xffffffff
	for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
	return (crc ^ 0xffffffff) >>> 0
}

function normalizeSeed(seed: number): number {
	const normalized = seed >>> 0
	return normalized === 0 ? 0x9e3779b9 : normalized
}

function xorshift32(value: number): number {
	let next = value >>> 0
	next ^= next << 13
	next ^= next >>> 17
	next ^= next << 5
	return next >>> 0
}
