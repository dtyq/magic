import { describe, expect, it } from "vitest"
import {
	calculateOggCrc,
	calculateOpusEndTrim48k,
	isValidOpusHead,
	OggOpusMuxer,
	readOpusPreSkip,
} from "../encoders/OggOpusMuxer"

const readAscii = (bytes: Uint8Array, offset: number, length: number): string =>
	String.fromCharCode(...bytes.subarray(offset, offset + length))

const parsePages = (file: ArrayBuffer): Uint8Array[] => {
	const bytes = new Uint8Array(file)
	const pages: Uint8Array[] = []
	let offset = 0
	while (offset < bytes.byteLength) {
		const pageSegments = bytes[offset + 26]
		const pageLength = 27 + pageSegments + pageSegmentsDataLength(bytes, offset)
		pages.push(bytes.slice(offset, offset + pageLength))
		offset += pageLength
	}
	return pages
}

const pageSegmentsDataLength = (bytes: Uint8Array, offset: number): number => {
	const segmentCount = bytes[offset + 26]
	let payloadLength = 0
	for (let index = 0; index < segmentCount; index++) payloadLength += bytes[offset + 27 + index]
	return payloadLength
}

describe("OggOpusMuxer", () => {
	it("calculates trim from final-frame padding rather than source remainder", () => {
		expect(calculateOpusEndTrim48k(0)).toBe(0)
		expect(calculateOpusEndTrim48k(320)).toBe(0)
		expect(calculateOpusEndTrim48k(321)).toBe(957)
		expect(calculateOpusEndTrim48k(1)).toBe(957)
	})
	it("writes independent Ogg pages with valid CRC, OpusHead, and EOS", () => {
		const muxer = new OggOpusMuxer({
			inputSampleRate: 16000,
			channels: 1,
			preSkip48k: 312,
			endTrim48k: 0,
			serialNumber: 0x10203040,
		})
		muxer.addPacket({ data: new Uint8Array(600), timestampUs: 0, durationUs: 20_000 })
		const pages = parsePages(muxer.finalize())

		expect(pages.length).toBe(3)
		expect(readAscii(pages[0], 0, 4)).toBe("OggS")
		expect(pages[0][5] & 0x02).toBe(0x02)
		expect(pages[pages.length - 1][5] & 0x04).toBe(0x04)

		pages.forEach((page, index) => {
			const sequence = new DataView(page.buffer, page.byteOffset).getUint32(18, true)
			expect(sequence).toBe(index)
			const storedCrc = new DataView(page.buffer, page.byteOffset).getUint32(22, true)
			const crcInput = new Uint8Array(page)
			new DataView(crcInput.buffer).setUint32(22, 0, true)
			expect(storedCrc).toBe(calculateOggCrc(crcInput))
		})

		const firstPayloadOffset = 27 + pages[0][26]
		const firstPayload = pages[0].subarray(firstPayloadOffset)
		expect(isValidOpusHead(firstPayload)).toBe(true)
		expect(readOpusPreSkip(firstPayload)).toBe(312)
	})

	it("supports a packet crossing the 255-segment page limit", () => {
		const muxer = new OggOpusMuxer({
			inputSampleRate: 16000,
			channels: 1,
			preSkip48k: 0,
			endTrim48k: 0,
			serialNumber: 0x50607080,
		})
		muxer.addPacket({ data: new Uint8Array(70_000), timestampUs: 0, durationUs: 20_000 })
		const pages = parsePages(muxer.finalize())

		expect(pages.some((page) => (page[5] & 0x01) === 0x01)).toBe(true)
		expect(pages[pages.length - 1][5] & 0x04).toBe(0x04)
	})

	it("does not share serial or page sequence state between chunks", () => {
		const createFile = (serialNumber: number) => {
			const muxer = new OggOpusMuxer({
				inputSampleRate: 16000,
				channels: 1,
				preSkip48k: 0,
				endTrim48k: 0,
				serialNumber,
			})
			muxer.addPacket({ data: new Uint8Array([1, 2, 3]), timestampUs: 0, durationUs: 20_000 })
			return parsePages(muxer.finalize())
		}

		const first = createFile(0x11111111)
		const second = createFile(0x22222222)
		expect(new DataView(first[0].buffer).getUint32(14, true)).toBe(0x11111111)
		expect(new DataView(second[0].buffer).getUint32(14, true)).toBe(0x22222222)
		expect(new DataView(first[0].buffer).getUint32(18, true)).toBe(0)
		expect(new DataView(second[0].buffer).getUint32(18, true)).toBe(0)
	})
})
