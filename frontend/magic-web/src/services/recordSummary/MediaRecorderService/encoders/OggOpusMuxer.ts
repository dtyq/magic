import type { OpusPacket } from "../types/RecorderTypes"

export const OGG_OPUS_MIME_TYPE = "audio/ogg; codecs=opus"

/** Calculate the 48 kHz trim needed to remove padding from a fixed-size Opus frame. */
export function calculateOpusEndTrim48k(sampleCount: number, frameSamples = 320): number {
	if (!Number.isInteger(sampleCount) || sampleCount < 0) {
		throw new Error("Opus sample count must be a non-negative integer")
	}
	if (!Number.isInteger(frameSamples) || frameSamples <= 0) {
		throw new Error("Opus frame size must be a positive integer")
	}
	const remainder = sampleCount % frameSamples
	return remainder === 0 ? 0 : (frameSamples - remainder) * 3
}

const OGG_CAPTURE_PATTERN = new Uint8Array([0x4f, 0x67, 0x67, 0x53])
const OPUS_HEAD_SIGNATURE = new Uint8Array([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])
const OPUS_TAGS_SIGNATURE = new Uint8Array([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73])
const MAX_PAGE_SEGMENTS = 255
const OGG_CLOCK_RATE = 48000

export interface OggOpusMuxerConfig {
	inputSampleRate: number
	channels: number
	preSkip48k: number
	endTrim48k: number
	opusHead?: Uint8Array
	vendor?: string
	serialNumber?: number
}

interface PageBuildOptions {
	packet: Uint8Array
	granulePosition: bigint
	bos: boolean
	eos: boolean
}

/** Create one independent Ogg logical stream for a single Opus business chunk. */
export class OggOpusMuxer {
	private readonly packets: OpusPacket[] = []
	private readonly serialNumber: number
	private pageSequenceNumber = 0

	constructor(private readonly config: OggOpusMuxerConfig) {
		this.validateConfig()
		this.serialNumber = config.serialNumber ?? createRandomSerialNumber()
	}

	/** Append one encoded packet while preserving encoder output order. */
	addPacket(packet: OpusPacket): void {
		if (packet.data.byteLength === 0) {
			throw new Error("Opus packet must not be empty")
		}
		if (!Number.isFinite(packet.durationUs) || packet.durationUs <= 0) {
			throw new Error("Opus packet duration must be positive")
		}
		this.packets.push({ ...packet, data: new Uint8Array(packet.data) })
	}

	/**
	 * Finalize headers, timed audio pages, CRC values, and the EOS marker.
	 * Streaming callers only know the end trim once every packet is in, so it may override the
	 * config value here.
	 */
	finalize(endTrim48k: number = this.config.endTrim48k): ArrayBuffer {
		if (this.packets.length === 0) {
			throw new Error("Cannot finalize an Ogg Opus stream without audio packets")
		}
		if (endTrim48k < 0) {
			throw new Error("Opus end trim must not be negative")
		}

		const pages: Uint8Array[] = []
		pages.push(
			...this.createPacketPages({
				packet: this.createOpusHead(),
				granulePosition: 0n,
				bos: true,
				eos: false,
			}),
		)
		pages.push(
			...this.createPacketPages({
				packet: this.createOpusTags(),
				granulePosition: 0n,
				bos: false,
				eos: false,
			}),
		)

		let decodedSamples48k = this.config.preSkip48k
		this.packets.forEach((packet, index) => {
			decodedSamples48k += Math.round((packet.durationUs * OGG_CLOCK_RATE) / 1_000_000)
			const isLastPacket = index === this.packets.length - 1
			const finalTrim = isLastPacket ? endTrim48k : 0
			pages.push(
				...this.createPacketPages({
					packet: packet.data,
					granulePosition: BigInt(Math.max(0, decodedSamples48k - finalTrim)),
					bos: false,
					eos: isLastPacket,
				}),
			)
		})

		const result = concatenateBytes(pages)
		return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
	}

	/** Validate fixed MVP constraints before any bytes are emitted. */
	private validateConfig(): void {
		if (this.config.inputSampleRate !== 16000 || this.config.channels !== 1) {
			throw new Error("OggOpusMuxer only supports 16 kHz mono input")
		}
		if (this.config.preSkip48k < 0 || this.config.endTrim48k < 0) {
			throw new Error("Opus pre-skip and end trim must not be negative")
		}
		if (this.config.preSkip48k > 0xffff) {
			throw new Error("Opus pre-skip exceeds OpusHead capacity")
		}
		if (this.config.opusHead && !isValidOpusHead(this.config.opusHead)) {
			throw new Error("Provided decoder configuration is not a valid OpusHead")
		}
	}

	/** Reuse an encoder-provided OpusHead or build the fixed mono mapping header. */
	private createOpusHead(): Uint8Array {
		if (this.config.opusHead) return new Uint8Array(this.config.opusHead)

		const header = new Uint8Array(19)
		header.set(OPUS_HEAD_SIGNATURE, 0)
		const view = new DataView(header.buffer)
		view.setUint8(8, 1)
		view.setUint8(9, this.config.channels)
		view.setUint16(10, this.config.preSkip48k, true)
		view.setUint32(12, this.config.inputSampleRate, true)
		view.setInt16(16, 0, true)
		view.setUint8(18, 0)
		return header
	}

	/** Build privacy-safe OpusTags without session or user metadata. */
	private createOpusTags(): Uint8Array {
		const vendor = new TextEncoder().encode(this.config.vendor ?? "synthetic-opus-encoder")
		const tags = new Uint8Array(16 + vendor.byteLength)
		tags.set(OPUS_TAGS_SIGNATURE, 0)
		const view = new DataView(tags.buffer)
		view.setUint32(8, vendor.byteLength, true)
		tags.set(vendor, 12)
		view.setUint32(12 + vendor.byteLength, 0, true)
		return tags
	}

	/** Split one packet across legal Ogg pages and mark continuation correctly. */
	private createPacketPages(options: PageBuildOptions): Uint8Array[] {
		const lacingValues = createLacingValues(options.packet.byteLength)
		const pages: Uint8Array[] = []
		let segmentOffset = 0
		let payloadOffset = 0

		while (segmentOffset < lacingValues.length) {
			const pageLacingValues = lacingValues.slice(
				segmentOffset,
				segmentOffset + MAX_PAGE_SEGMENTS,
			)
			const payloadLength = pageLacingValues.reduce((total, value) => total + value, 0)
			const packetCompletesOnPage =
				segmentOffset + pageLacingValues.length === lacingValues.length
			const headerType =
				(segmentOffset > 0 ? 0x01 : 0) |
				(options.bos && segmentOffset === 0 ? 0x02 : 0) |
				(options.eos && packetCompletesOnPage ? 0x04 : 0)

			pages.push(
				this.createPage(
					headerType,
					packetCompletesOnPage ? options.granulePosition : -1n,
					pageLacingValues,
					options.packet.subarray(payloadOffset, payloadOffset + payloadLength),
				),
			)
			segmentOffset += pageLacingValues.length
			payloadOffset += payloadLength
		}
		return pages
	}

	/** Assemble one page and calculate CRC over the complete zeroed-checksum page. */
	private createPage(
		headerType: number,
		granulePosition: bigint,
		lacingValues: number[],
		payload: Uint8Array,
	): Uint8Array {
		const page = new Uint8Array(27 + lacingValues.length + payload.byteLength)
		page.set(OGG_CAPTURE_PATTERN, 0)
		const view = new DataView(page.buffer)
		view.setUint8(4, 0)
		view.setUint8(5, headerType)
		view.setBigUint64(6, BigInt.asUintN(64, granulePosition), true)
		view.setUint32(14, this.serialNumber, true)
		view.setUint32(18, this.pageSequenceNumber++, true)
		view.setUint32(22, 0, true)
		view.setUint8(26, lacingValues.length)
		page.set(lacingValues, 27)
		page.set(payload, 27 + lacingValues.length)
		view.setUint32(22, calculateOggCrc(page), true)
		return page
	}
}

/** Validate the identification header required by the Ogg Opus mapping. */
export function isValidOpusHead(data: Uint8Array): boolean {
	return (
		data.byteLength >= 19 &&
		OPUS_HEAD_SIGNATURE.every((value, index) => data[index] === value) &&
		data[8] === 1 &&
		data[9] === 1
	)
}

/** Read encoder delay from a validated OpusHead in the 48 kHz clock domain. */
export function readOpusPreSkip(data: Uint8Array): number {
	if (!isValidOpusHead(data)) throw new Error("Cannot read pre-skip from an invalid OpusHead")
	return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(10, true)
}

/** Calculate the Ogg CRC-32 polynomial over a complete page. */
export function calculateOggCrc(data: Uint8Array): number {
	let crc = 0
	for (const value of data) {
		crc = ((crc << 8) ^ OGG_CRC_LOOKUP[((crc >>> 24) & 0xff) ^ value]) >>> 0
	}
	return crc
}

/** Create lacing values, including the terminating zero for exact 255-byte multiples. */
function createLacingValues(packetLength: number): number[] {
	const values: number[] = []
	let remaining = packetLength
	while (remaining >= 255) {
		values.push(255)
		remaining -= 255
	}
	values.push(remaining)
	return values
}

/** Generate a different logical stream serial for every independent business chunk. */
function createRandomSerialNumber(): number {
	const values = new Uint32Array(1)
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(values)
		return values[0]
	}
	return Math.floor(Math.random() * 0x1_0000_0000) >>> 0
}

/** Concatenate pages into the final in-memory file without sharing mutable buffers. */
function concatenateBytes(parts: Uint8Array[]): Uint8Array {
	const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
	let offset = 0
	for (const part of parts) {
		result.set(part, offset)
		offset += part.byteLength
	}
	return result
}

/** Build the fixed lookup table once for the Ogg polynomial. */
function createOggCrcLookup(): Uint32Array {
	const lookup = new Uint32Array(256)
	for (let index = 0; index < lookup.length; index++) {
		let value = index << 24
		for (let bit = 0; bit < 8; bit++) {
			value = value & 0x8000_0000 ? (value << 1) ^ 0x04c1_1db7 : value << 1
		}
		lookup[index] = value >>> 0
	}
	return lookup
}

const OGG_CRC_LOOKUP = createOggCrcLookup()
