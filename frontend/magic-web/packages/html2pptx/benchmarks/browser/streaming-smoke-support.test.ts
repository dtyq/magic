import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { createInstrumentedSink, inspectZipArchive, sha256Blob } from "./streaming-smoke-support"

describe("streaming smoke archive inspection", () => {
	it("reads a classic ZIP tail and scans slide entries across small chunks", async () => {
		const archive = createClassicZip(
			[
				{ name: "[Content_Types].xml", data: patternedBytes(200_000, 0x42) },
				{ name: "ppt/slides/slide1.xml" },
				{ name: "ppt/slides/slide2.xml" },
			],
			new TextEncoder().encode("fixture-comment"),
		)

		const result = await inspectZipArchive(new Blob([archive]), 3, {
			centralDirectoryChunkBytes: 31,
		})

		expect(result.archiveType).toBe("classic")
		expect(result.centralDirectoryEntryCount).toBe(3)
		expect(result.slideXmlCount).toBe(2)
		expect(result.missingSlideNumbers).toEqual([3])
		expect(result.centralDirectoryOffset).toBeGreaterThan(0)
		expect(result.centralDirectorySize).toBeGreaterThan(31)
		expect(result.centralDirectoryBytesRead).toBeLessThanOrEqual(result.centralDirectorySize)
		expect(result.maxArchiveValidationBufferBytes).toBeLessThan(archive.byteLength)
	})

	it("parses ZIP64 EOCD metadata and central-directory entries", async () => {
		const archive = createZip64([
			{ name: "ppt/slides/slide1.xml" },
			{ name: "ppt/theme/theme1.xml" },
		])

		const result = await inspectZipArchive(new Blob([archive]), 1, {
			centralDirectoryChunkBytes: 23,
		})

		expect(result.archiveType).toBe("zip64")
		expect(result.centralDirectoryEntryCount).toBe(2)
		expect(result.slideXmlCount).toBe(1)
		expect(result.missingSlideNumbers).toEqual([])
		expect(result.archiveMetadataBytesRead).toBeGreaterThanOrEqual(56)
	})

	it("honors variable filename, extra, and comment lengths across chunk boundaries", async () => {
		const archive = createClassicZip([
			{
				name: `custom/${"x".repeat(513)}.bin`,
				extra: patternedBytes(73, 0xa1),
				comment: patternedBytes(81, 0xb2),
			},
			{
				name: "ppt/slides/slide1.xml",
				extra: patternedBytes(67, 0xc3),
				comment: patternedBytes(79, 0xd4),
			},
		])

		const result = await inspectZipArchive(new Blob([archive]), 1, {
			centralDirectoryChunkBytes: 17,
		})

		expect(result.centralDirectoryEntryCount).toBe(2)
		expect(result.slideXmlCount).toBe(1)
		expect(result.missingSlideNumbers).toEqual([])
	})

	it("fails clearly for empty or malformed ZIP tails", async () => {
		await expect(inspectZipArchive(new Blob([]), 0)).rejects.toThrow("too small to contain")

		const malformed = createClassicZip([{ name: "ppt/slides/slide1.xml" }]).slice()
		writeUint16LittleEndian(malformed, malformed.byteLength - 2, 7)
		await expect(inspectZipArchive(new Blob([malformed]), 1)).rejects.toThrow("was not found")
	})
})

describe("streaming SHA-256", () => {
	it("matches the known digest without retaining all input chunks", async () => {
		const chunks = [
			new TextEncoder().encode("a"),
			new TextEncoder().encode("bc"),
			patternedBytes(65, 0x5a),
			patternedBytes(257, 0x6b),
		]
		const expected = createHash("sha256")
		for (const chunk of chunks) expected.update(chunk)

		const result = await sha256Blob(createChunkedBlob(chunks))

		expect(result.sha256).toBe(expected.digest("hex"))
		expect(result.bytesRead).toBe(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0))
		expect(result.chunkCount).toBe(chunks.length)
		expect(result.maxChunkBytes).toBe(257)
	})

	it("bounds a native Blob hash read to the configured range size", async () => {
		const bytes = patternedBytes(1_048_699, 0x11)
		const expected = createHash("sha256").update(bytes).digest("hex")
		const result = await sha256Blob(new Blob([bytes]), { chunkBytes: 64 * 1024 })

		expect(result.sha256).toBe(expected)
		expect(result.bytesRead).toBe(bytes.byteLength)
		expect(result.chunkCount).toBe(Math.ceil(bytes.byteLength / (64 * 1024)))
		expect(result.maxChunkBytes).toBe(64 * 1024)
	})

	it("matches the standard abc SHA-256 vector", async () => {
		const result = await sha256Blob(new Blob([new TextEncoder().encode("abc")]))
		expect(result.sha256).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		)
	})
})

describe("streaming sink telemetry", () => {
	it("tracks chunk, in-flight, completion-wait, close, and abort metrics", async () => {
		let clock = 0
		const releases: Array<() => void> = []
		const close = vi.fn()
		const abort = vi.fn()
		const instrumented = createInstrumentedSink(
			{
				write: vi.fn(
					() =>
						new Promise<void>((resolve) => {
							releases.push(resolve)
						}),
				),
				close,
				abort,
			},
			{ now: () => clock },
		)

		const first = instrumented.sink.write(new Uint8Array(2))
		clock = 5
		const second = instrumented.sink.write(new Uint8Array(3))
		expect(instrumented.snapshot()).toMatchObject({
			chunkCount: 2,
			totalChunkBytes: 5,
			maxChunkBytes: 3,
			currentInFlightBytes: 5,
			currentInFlightChunks: 2,
			maxInFlightBytes: 5,
			maxInFlightChunks: 2,
		})

		clock = 15
		releases[0]!()
		await first
		clock = 25
		releases[1]!()
		await second
		await instrumented.sink.close()
		await instrumented.sink.abort?.("fixture abort")

		expect(instrumented.snapshot()).toEqual({
			chunkCount: 2,
			totalChunkBytes: 5,
			maxChunkBytes: 3,
			currentInFlightBytes: 0,
			currentInFlightChunks: 0,
			maxInFlightBytes: 5,
			maxInFlightChunks: 2,
			writeWaitCount: 2,
			writeWaitTotalMs: 35,
			writeWaitMaxMs: 20,
			ackWaitCount: 2,
			ackWaitTotalMs: 35,
			ackWaitMaxMs: 20,
			failedWriteCount: 0,
			closeCount: 1,
			abortCount: 1,
		})
		expect(close).toHaveBeenCalledOnce()
		expect(abort).toHaveBeenCalledWith("fixture abort")
	})

	it("releases in-flight accounting when a sink write fails", async () => {
		const instrumented = createInstrumentedSink({
			write: () => Promise.reject(new Error("disk full")),
			close: vi.fn(),
		})

		await expect(instrumented.sink.write(new Uint8Array(4))).rejects.toThrow("disk full")
		expect(instrumented.snapshot()).toMatchObject({
			currentInFlightBytes: 0,
			currentInFlightChunks: 0,
			writeWaitCount: 1,
			ackWaitCount: 0,
			failedWriteCount: 1,
		})
	})
})

interface ZipEntryFixture {
	name: string
	data?: Uint8Array
	extra?: Uint8Array
	comment?: Uint8Array
}

function createClassicZip(
	entries: ZipEntryFixture[],
	archiveComment = new Uint8Array(),
): Uint8Array {
	const { localBytes, centralDirectoryBytes } = createZipParts(entries)
	const eocd = new Uint8Array(22 + archiveComment.byteLength)
	writeUint32LittleEndian(eocd, 0, 0x06054b50)
	writeUint16LittleEndian(eocd, 8, entries.length)
	writeUint16LittleEndian(eocd, 10, entries.length)
	writeUint32LittleEndian(eocd, 12, centralDirectoryBytes.byteLength)
	writeUint32LittleEndian(eocd, 16, localBytes.byteLength)
	writeUint16LittleEndian(eocd, 20, archiveComment.byteLength)
	eocd.set(archiveComment, 22)
	return concatenate([localBytes, centralDirectoryBytes, eocd])
}

function createZip64(entries: ZipEntryFixture[]): Uint8Array {
	const { localBytes, centralDirectoryBytes } = createZipParts(entries)
	const zip64RecordOffset = localBytes.byteLength + centralDirectoryBytes.byteLength
	const zip64Record = new Uint8Array(56)
	writeUint32LittleEndian(zip64Record, 0, 0x06064b50)
	writeUint64LittleEndian(zip64Record, 4, 44)
	writeUint16LittleEndian(zip64Record, 12, 45)
	writeUint16LittleEndian(zip64Record, 14, 45)
	writeUint64LittleEndian(zip64Record, 24, entries.length)
	writeUint64LittleEndian(zip64Record, 32, entries.length)
	writeUint64LittleEndian(zip64Record, 40, centralDirectoryBytes.byteLength)
	writeUint64LittleEndian(zip64Record, 48, localBytes.byteLength)

	const locator = new Uint8Array(20)
	writeUint32LittleEndian(locator, 0, 0x07064b50)
	writeUint64LittleEndian(locator, 8, zip64RecordOffset)
	writeUint32LittleEndian(locator, 16, 1)

	const eocd = new Uint8Array(22)
	writeUint32LittleEndian(eocd, 0, 0x06054b50)
	writeUint16LittleEndian(eocd, 8, 0xffff)
	writeUint16LittleEndian(eocd, 10, 0xffff)
	writeUint32LittleEndian(eocd, 12, 0xffffffff)
	writeUint32LittleEndian(eocd, 16, 0xffffffff)

	return concatenate([localBytes, centralDirectoryBytes, zip64Record, locator, eocd])
}

function createZipParts(entries: ZipEntryFixture[]): {
	localBytes: Uint8Array
	centralDirectoryBytes: Uint8Array
} {
	const encoder = new TextEncoder()
	const locals: Uint8Array[] = []
	const centralEntries: Uint8Array[] = []
	let localOffset = 0

	for (const entry of entries) {
		const name = encoder.encode(entry.name)
		const data = entry.data ?? new Uint8Array()
		const extra = entry.extra ?? new Uint8Array()
		const comment = entry.comment ?? new Uint8Array()
		const local = new Uint8Array(30 + name.byteLength + extra.byteLength + data.byteLength)
		writeUint32LittleEndian(local, 0, 0x04034b50)
		writeUint16LittleEndian(local, 4, 20)
		writeUint16LittleEndian(local, 6, 0x0800)
		writeUint16LittleEndian(local, 26, name.byteLength)
		writeUint16LittleEndian(local, 28, extra.byteLength)
		writeUint32LittleEndian(local, 18, data.byteLength)
		writeUint32LittleEndian(local, 22, data.byteLength)
		local.set(name, 30)
		local.set(extra, 30 + name.byteLength)
		local.set(data, 30 + name.byteLength + extra.byteLength)
		locals.push(local)

		const central = new Uint8Array(46 + name.byteLength + extra.byteLength + comment.byteLength)
		writeUint32LittleEndian(central, 0, 0x02014b50)
		writeUint16LittleEndian(central, 4, 45)
		writeUint16LittleEndian(central, 6, 20)
		writeUint16LittleEndian(central, 8, 0x0800)
		writeUint16LittleEndian(central, 28, name.byteLength)
		writeUint16LittleEndian(central, 30, extra.byteLength)
		writeUint16LittleEndian(central, 32, comment.byteLength)
		writeUint32LittleEndian(central, 20, data.byteLength)
		writeUint32LittleEndian(central, 24, data.byteLength)
		writeUint32LittleEndian(central, 42, localOffset)
		central.set(name, 46)
		central.set(extra, 46 + name.byteLength)
		central.set(comment, 46 + name.byteLength + extra.byteLength)
		centralEntries.push(central)
		localOffset += local.byteLength
	}

	return {
		localBytes: concatenate(locals),
		centralDirectoryBytes: concatenate(centralEntries),
	}
}

function createChunkedBlob(chunks: Uint8Array[]): Blob {
	const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
	return {
		size,
		stream() {
			return new ReadableStream<Uint8Array>({
				start(controller) {
					for (const chunk of chunks) controller.enqueue(chunk)
					controller.close()
				},
			})
		},
	} as Blob
}

function patternedBytes(length: number, seed: number): Uint8Array {
	const bytes = new Uint8Array(length)
	for (let index = 0; index < length; index += 1) bytes[index] = (seed + index * 29) & 0xff
	return bytes
}

function concatenate(parts: Uint8Array[]): Uint8Array {
	const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
	let offset = 0
	for (const part of parts) {
		output.set(part, offset)
		offset += part.byteLength
	}
	return output
}

function writeUint16LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
	bytes[offset] = value
	bytes[offset + 1] = value >>> 8
}

function writeUint32LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
	bytes[offset] = value
	bytes[offset + 1] = value >>> 8
	bytes[offset + 2] = value >>> 16
	bytes[offset + 3] = value >>> 24
}

function writeUint64LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
	writeUint32LittleEndian(bytes, offset, value >>> 0)
	writeUint32LittleEndian(bytes, offset + 4, Math.floor(value / 0x1_0000_0000))
}
