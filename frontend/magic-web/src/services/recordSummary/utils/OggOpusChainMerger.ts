import { createDecoder } from "libopus-wasm"
import {
	calculateOggCrc,
	isValidOpusHead,
	readOpusPreSkip,
} from "../MediaRecorderService/encoders/OggOpusMuxer"
import { WasmOpusEncoder } from "../MediaRecorderService/encoders/WasmOpusEncoder"

const OGG_CAPTURE_PATTERN = [0x4f, 0x67, 0x67, 0x53]
const OPUS_TAGS_SIGNATURE = [0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]

interface ParsedOggPage {
	offset: number
	length: number
}

interface ParsedOggStream {
	audioPackets: Uint8Array[]
	preSkip48k: number
	finalGranule48k: bigint
}

/**
 * Decode independent streams and re-encode one continuous, playable Ogg Opus export.
 * Chunks are decoded one at a time and fed straight into the streaming encoder, so peak
 * memory is one chunk of PCM instead of the whole recording (hours of 16 kHz PCM is GBs).
 */
export async function mergeOggOpusChunks(blobs: Blob[]): Promise<Blob | null> {
	if (blobs.length === 0) return null

	async function* decodeChunks(): AsyncGenerator<Int16Array> {
		for (const blob of blobs) {
			const parsed = parseOggOpusStream(new Uint8Array(await readBlobAsArrayBuffer(blob)))
			yield await decodeOggOpusStream(parsed)
		}
	}

	const encoder = new WasmOpusEncoder(32_000)
	try {
		await encoder.initialize()
		const encoded = await encoder.encodeStream(decodeChunks())
		return encoded ? new Blob([encoded.data], { type: encoded.mimeType }) : null
	} finally {
		await encoder.close()
	}
}

/** Read Blob bytes in browsers and test environments that do not expose Blob.arrayBuffer. */
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer()

	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as ArrayBuffer)
		reader.onerror = () => reject(reader.error)
		reader.readAsArrayBuffer(blob)
	})
}

/** Parse pages and packets so malformed or incomplete history chunks are never exported. */
function parseOggOpusStream(bytes: Uint8Array): ParsedOggStream {
	const pages: ParsedOggPage[] = []
	const packets: Uint8Array[] = []
	let packetParts: Uint8Array[] = []
	let offset = 0
	let expectedSequence = 0
	let streamSerial: number | null = null
	let finalGranule48k = 0n

	while (offset < bytes.byteLength) {
		if (offset + 27 > bytes.byteLength || !hasSignature(bytes, offset, OGG_CAPTURE_PATTERN)) {
			throw new Error("Invalid Ogg page header in exported recording")
		}

		const view = new DataView(bytes.buffer, bytes.byteOffset + offset)
		const headerType = view.getUint8(5)
		const pageSerial = view.getUint32(14, true)
		const pageSequence = view.getUint32(18, true)
		const granulePosition = view.getBigUint64(6, true)
		const segmentCount = view.getUint8(26)
		const headerLength = 27 + segmentCount
		if (offset + headerLength > bytes.byteLength) {
			throw new Error("Truncated Ogg segment table in exported recording")
		}

		let payloadLength = 0
		for (let index = 0; index < segmentCount; index++) {
			payloadLength += bytes[offset + 27 + index]
		}
		const pageLength = headerLength + payloadLength
		if (offset + pageLength > bytes.byteLength) {
			throw new Error("Truncated Ogg page payload in exported recording")
		}

		if (streamSerial === null) streamSerial = pageSerial
		if (pageSerial !== streamSerial || pageSequence !== expectedSequence) {
			throw new Error("Invalid Ogg logical stream sequence in exported recording")
		}
		if (expectedSequence === 0 && (headerType & 0x02) === 0) {
			throw new Error("Ogg Opus stream is missing its BOS page")
		}
		if (expectedSequence > 0 && (headerType & 0x02) !== 0) {
			throw new Error("Ogg Opus stream contains an unexpected BOS page")
		}
		validatePageCrc(bytes.subarray(offset, offset + pageLength))

		let payloadOffset = offset + headerLength
		for (let index = 0; index < segmentCount; index++) {
			const segmentLength = bytes[offset + 27 + index]
			packetParts.push(bytes.slice(payloadOffset, payloadOffset + segmentLength))
			payloadOffset += segmentLength
			if (segmentLength < 255) {
				packets.push(concatenateBytes(packetParts))
				packetParts = []
			}
		}

		pages.push({ offset, length: pageLength })
		if ((headerType & 0x04) !== 0) finalGranule48k = granulePosition
		offset += pageLength
		expectedSequence++
	}

	if (packetParts.length > 0 || pages.length === 0) {
		throw new Error("Ogg Opus stream ends with an incomplete packet")
	}
	const finalHeaderType = bytes[pages[pages.length - 1].offset + 5]
	if ((finalHeaderType & 0x04) === 0) {
		throw new Error("Ogg Opus stream is missing its EOS page")
	}
	if (!packets[0] || !isValidOpusHead(packets[0])) {
		throw new Error("Ogg Opus stream is missing a valid OpusHead packet")
	}
	if (!packets[1] || !hasSignature(packets[1], 0, OPUS_TAGS_SIGNATURE)) {
		throw new Error("Ogg Opus stream is missing a valid OpusTags packet")
	}
	if (packets.length < 3 || packets.slice(2).some((packet) => packet.byteLength === 0)) {
		throw new Error("Ogg Opus stream does not contain playable audio packets")
	}
	const preSkip48k = readOpusPreSkip(packets[0])
	if (finalGranule48k < BigInt(preSkip48k)) {
		throw new Error("Ogg Opus stream has an invalid final granule position")
	}

	return { audioPackets: packets.slice(2), preSkip48k, finalGranule48k }
}

/** Decode one logical stream with a fresh decoder and apply its final end trim. */
async function decodeOggOpusStream(stream: ParsedOggStream): Promise<Int16Array> {
	let decoder: Awaited<ReturnType<typeof createDecoder>> | null = null
	try {
		decoder = await createDecoder({ channels: 1, sampleRate: 16_000 })
		const activeDecoder = decoder
		const decoded = concatenatePcm(
			stream.audioPackets.map((packet) => activeDecoder.decode(packet)),
		)
		const playableSamples48k = stream.finalGranule48k - BigInt(stream.preSkip48k)
		if (playableSamples48k > BigInt(Number.MAX_SAFE_INTEGER)) {
			throw new Error("Ogg Opus stream is too long to export safely")
		}
		const playableSamples16k = Math.round(Number(playableSamples48k) / 3)
		if (playableSamples16k <= 0 || playableSamples16k > decoded.length) {
			throw new Error("Ogg Opus stream duration does not match its decoded audio")
		}
		return decoded.slice(0, playableSamples16k)
	} finally {
		decoder?.free()
	}
}

/** Verify the stored checksum before a page is copied into the chained export. */
function validatePageCrc(page: Uint8Array): void {
	const storedCrc = new DataView(page.buffer, page.byteOffset, page.byteLength).getUint32(
		22,
		true,
	)
	const crcInput = new Uint8Array(page)
	new DataView(crcInput.buffer).setUint32(22, 0, true)
	if (calculateOggCrc(crcInput) !== storedCrc) {
		throw new Error("Ogg page checksum validation failed during history export")
	}
}

/** Compare a byte signature without decoding arbitrary audio payload data. */
function hasSignature(bytes: Uint8Array, offset: number, signature: number[]): boolean {
	return signature.every((value, index) => bytes[offset + index] === value)
}

/** Join packet segments into an independent byte array for header validation. */
function concatenateBytes(parts: Uint8Array[]): Uint8Array {
	const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
	let offset = 0
	for (const part of parts) {
		result.set(part, offset)
		offset += part.byteLength
	}
	return result
}

/** Concatenate decoded mono PCM without retaining mutable decoder buffers. */
function concatenatePcm(parts: Int16Array[]): Int16Array {
	const result = new Int16Array(parts.reduce((total, part) => total + part.length, 0))
	let offset = 0
	for (const part of parts) {
		result.set(part, offset)
		offset += part.length
	}
	return result
}
