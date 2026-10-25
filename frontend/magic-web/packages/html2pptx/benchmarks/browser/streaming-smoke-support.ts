const CENTRAL_DIRECTORY_ENTRY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50
const MAX_END_OF_CENTRAL_DIRECTORY_COMMENT_BYTES = 0xffff
const END_OF_CENTRAL_DIRECTORY_BYTES = 22
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_BYTES = 20
const ZIP64_END_OF_CENTRAL_DIRECTORY_MIN_BYTES = 56
const CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES = 46
const MAX_CENTRAL_DIRECTORY_ENTRY_BYTES = CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES + 0xffff * 3
const DEFAULT_TAIL_WINDOW_BYTES = 128 * 1024
const DEFAULT_CENTRAL_DIRECTORY_CHUNK_BYTES = 256 * 1024
const DEFAULT_HASH_CHUNK_BYTES = 1024 * 1024

export interface ZipArchiveInspection {
	archiveType: "classic" | "zip64"
	centralDirectoryEntryCount: number
	centralDirectoryOffset: number
	centralDirectorySize: number
	slideXmlCount: number
	missingSlideNumbers: number[]
	archiveMetadataBytesRead: number
	centralDirectoryBytesRead: number
	maxArchiveValidationBufferBytes: number
}

export interface StreamHashResult {
	sha256: string
	bytesRead: number
	chunkCount: number
	maxChunkBytes: number
	durationMs: number
}

export interface SinkTelemetrySnapshot {
	chunkCount: number
	totalChunkBytes: number
	maxChunkBytes: number
	currentInFlightBytes: number
	currentInFlightChunks: number
	maxInFlightBytes: number
	maxInFlightChunks: number
	writeWaitCount: number
	writeWaitTotalMs: number
	writeWaitMaxMs: number
	ackWaitCount: number
	ackWaitTotalMs: number
	ackWaitMaxMs: number
	failedWriteCount: number
	closeCount: number
	abortCount: number
}

export interface SmokeOutputSink {
	write(chunk: Uint8Array): void | Promise<void>
	close(): void | Promise<void>
	abort?(reason?: unknown): void | Promise<void>
}

export async function inspectZipArchive(
	file: Blob,
	expectedSlides: number,
	options: {
		tailWindowBytes?: number
		centralDirectoryChunkBytes?: number
	} = {},
): Promise<ZipArchiveInspection> {
	if (!Number.isSafeInteger(expectedSlides) || expectedSlides < 0) {
		throw new RangeError("expectedSlides must be a non-negative safe integer")
	}

	const tailWindowBytes = readPositiveSafeInteger(
		options.tailWindowBytes,
		DEFAULT_TAIL_WINDOW_BYTES,
		"tailWindowBytes",
	)
	const centralDirectoryChunkBytes = readPositiveSafeInteger(
		options.centralDirectoryChunkBytes,
		DEFAULT_CENTRAL_DIRECTORY_CHUNK_BYTES,
		"centralDirectoryChunkBytes",
	)
	const metadata = await readZipDirectoryMetadata(file, tailWindowBytes)
	const directory = await scanCentralDirectory(
		file,
		metadata.centralDirectoryOffset,
		metadata.centralDirectorySize,
		metadata.centralDirectoryEntryCount,
		expectedSlides,
		centralDirectoryChunkBytes,
	)

	return {
		archiveType: metadata.archiveType,
		centralDirectoryEntryCount: directory.centralDirectoryEntryCount,
		centralDirectoryOffset: metadata.centralDirectoryOffset,
		centralDirectorySize: metadata.centralDirectorySize,
		slideXmlCount: directory.slideXmlCount,
		missingSlideNumbers: directory.missingSlideNumbers,
		archiveMetadataBytesRead: metadata.bytesRead,
		centralDirectoryBytesRead: directory.bytesRead,
		maxArchiveValidationBufferBytes: Math.max(
			metadata.maxBufferBytes,
			directory.maxBufferBytes,
		),
	}
}

export async function sha256Blob(
	file: Blob,
	options: { chunkBytes?: number } = {},
): Promise<StreamHashResult> {
	const chunkBytes = readPositiveSafeInteger(
		options.chunkBytes,
		DEFAULT_HASH_CHUNK_BYTES,
		"hashChunkBytes",
	)
	const startedAt = performance.now()
	const hasher = new IncrementalSha256()
	let bytesRead = 0
	let chunkCount = 0
	let maxChunkBytes = 0

	if (typeof file.slice === "function") {
		for (let offset = 0; offset < file.size; offset += chunkBytes) {
			const chunk = new Uint8Array(
				await file.slice(offset, Math.min(offset + chunkBytes, file.size)).arrayBuffer(),
			)
			if (chunk.byteLength === 0) continue
			hasher.update(chunk)
			bytesRead += chunk.byteLength
			chunkCount += 1
			maxChunkBytes = Math.max(maxChunkBytes, chunk.byteLength)
		}
	} else {
		// Keep the helper usable with the tiny stream-only Blob test double.
		const reader = file.stream().getReader()
		try {
			for (;;) {
				const { done, value } = await reader.read()
				if (done) break
				if (!value || value.byteLength === 0) continue
				for (let offset = 0; offset < value.byteLength; offset += chunkBytes) {
					const chunk = value.subarray(
						offset,
						Math.min(offset + chunkBytes, value.byteLength),
					)
					hasher.update(chunk)
					bytesRead += chunk.byteLength
					chunkCount += 1
					maxChunkBytes = Math.max(maxChunkBytes, chunk.byteLength)
				}
			}
		} finally {
			reader.releaseLock()
		}
	}

	if (bytesRead !== file.size) {
		throw new Error(`SHA-256 stream read ${bytesRead} bytes; expected ${file.size}`)
	}

	return {
		sha256: hasher.digestHex(),
		bytesRead,
		chunkCount,
		maxChunkBytes,
		durationMs: performance.now() - startedAt,
	}
}

export function createInstrumentedSink(
	target: SmokeOutputSink,
	options: { now?: () => number } = {},
): { sink: SmokeOutputSink; snapshot(): SinkTelemetrySnapshot } {
	const now = options.now ?? (() => performance.now())
	const metrics: SinkTelemetrySnapshot = {
		chunkCount: 0,
		totalChunkBytes: 0,
		maxChunkBytes: 0,
		currentInFlightBytes: 0,
		currentInFlightChunks: 0,
		maxInFlightBytes: 0,
		maxInFlightChunks: 0,
		writeWaitCount: 0,
		writeWaitTotalMs: 0,
		writeWaitMaxMs: 0,
		ackWaitCount: 0,
		ackWaitTotalMs: 0,
		ackWaitMaxMs: 0,
		failedWriteCount: 0,
		closeCount: 0,
		abortCount: 0,
	}

	return {
		sink: {
			async write(chunk) {
				const chunkBytes = chunk.byteLength
				metrics.chunkCount += 1
				metrics.totalChunkBytes += chunkBytes
				metrics.maxChunkBytes = Math.max(metrics.maxChunkBytes, chunkBytes)
				metrics.currentInFlightBytes += chunkBytes
				metrics.currentInFlightChunks += 1
				metrics.maxInFlightBytes = Math.max(
					metrics.maxInFlightBytes,
					metrics.currentInFlightBytes,
				)
				metrics.maxInFlightChunks = Math.max(
					metrics.maxInFlightChunks,
					metrics.currentInFlightChunks,
				)
				metrics.writeWaitCount += 1
				const startedAt = now()
				let completed = false

				try {
					await target.write(chunk)
					completed = true
				} catch (error) {
					metrics.failedWriteCount += 1
					throw error
				} finally {
					const waitMs = elapsedMs(startedAt, now())
					metrics.writeWaitTotalMs += waitMs
					metrics.writeWaitMaxMs = Math.max(metrics.writeWaitMaxMs, waitMs)
					if (completed) {
						metrics.ackWaitCount += 1
						metrics.ackWaitTotalMs += waitMs
						metrics.ackWaitMaxMs = Math.max(metrics.ackWaitMaxMs, waitMs)
					}
					metrics.currentInFlightBytes -= chunkBytes
					metrics.currentInFlightChunks -= 1
				}
			},
			async close() {
				metrics.closeCount += 1
				await target.close()
			},
			async abort(reason) {
				metrics.abortCount += 1
				await target.abort?.(reason)
			},
		},
		snapshot() {
			return { ...metrics }
		},
	}
}

async function readZipDirectoryMetadata(
	file: Blob,
	tailWindowBytes: number,
): Promise<{
	archiveType: "classic" | "zip64"
	centralDirectoryEntryCount: number
	centralDirectoryOffset: number
	centralDirectorySize: number
	bytesRead: number
	maxBufferBytes: number
}> {
	if (file.size < END_OF_CENTRAL_DIRECTORY_BYTES) {
		throw new Error("ZIP file is too small to contain an end-of-central-directory record")
	}

	const minimumTailBytes =
		END_OF_CENTRAL_DIRECTORY_BYTES +
		MAX_END_OF_CENTRAL_DIRECTORY_COMMENT_BYTES +
		ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_BYTES
	const tailBytes = Math.min(file.size, Math.max(tailWindowBytes, minimumTailBytes))
	const tailStart = file.size - tailBytes
	const tail = await readBlobRange(file, tailStart, file.size)
	const eocdOffset = findEndOfCentralDirectory(tail)
	if (eocdOffset < 0) {
		throw new Error("ZIP end-of-central-directory record was not found in the file tail")
	}

	const absoluteEocdOffset = tailStart + eocdOffset
	const diskNumber = readUint16(tail, eocdOffset + 4)
	const centralDirectoryDisk = readUint16(tail, eocdOffset + 6)
	const entriesOnDisk = readUint16(tail, eocdOffset + 8)
	const entryCount32 = readUint16(tail, eocdOffset + 10)
	const centralDirectorySize32 = readUint32(tail, eocdOffset + 12)
	const centralDirectoryOffset32 = readUint32(tail, eocdOffset + 16)
	const requiresZip64 =
		entriesOnDisk === 0xffff ||
		entryCount32 === 0xffff ||
		centralDirectorySize32 === 0xffffffff ||
		centralDirectoryOffset32 === 0xffffffff
	const locatorOffset = eocdOffset - ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_BYTES
	const hasZip64Locator =
		locatorOffset >= 0 &&
		readUint32(tail, locatorOffset) === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE

	if (!requiresZip64 && !hasZip64Locator) {
		if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount32) {
			throw new Error("Multi-disk ZIP archives are not supported by the streaming smoke")
		}
		assertCentralDirectoryBounds(
			file.size,
			centralDirectoryOffset32,
			centralDirectorySize32,
			absoluteEocdOffset,
		)
		return {
			archiveType: "classic",
			centralDirectoryEntryCount: entryCount32,
			centralDirectoryOffset: centralDirectoryOffset32,
			centralDirectorySize: centralDirectorySize32,
			bytesRead: tail.byteLength,
			maxBufferBytes: tail.byteLength,
		}
	}

	if (!hasZip64Locator) {
		throw new Error("ZIP64 markers were present without a ZIP64 locator")
	}
	const zip64Disk = readUint32(tail, locatorOffset + 4)
	const zip64RecordOffset = readUint64(tail, locatorOffset + 8, "ZIP64 EOCD offset")
	const diskCount = readUint32(tail, locatorOffset + 16)
	if (zip64Disk !== 0 || diskCount !== 1) {
		throw new Error("Multi-disk ZIP64 archives are not supported by the streaming smoke")
	}
	const zip64Record = await readBlobRange(
		file,
		zip64RecordOffset,
		zip64RecordOffset + ZIP64_END_OF_CENTRAL_DIRECTORY_MIN_BYTES,
	)
	if (
		zip64Record.byteLength < ZIP64_END_OF_CENTRAL_DIRECTORY_MIN_BYTES ||
		readUint32(zip64Record, 0) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE
	) {
		throw new Error("ZIP64 end-of-central-directory record is missing or truncated")
	}
	const zip64RecordPayloadBytes = readUint64(zip64Record, 4, "ZIP64 EOCD record size")
	if (zip64RecordPayloadBytes < 44) {
		throw new Error("ZIP64 end-of-central-directory record is shorter than the fixed fields")
	}
	if (zip64RecordOffset + 12 + zip64RecordPayloadBytes > absoluteEocdOffset - 20) {
		throw new Error("ZIP64 end-of-central-directory record overlaps its locator")
	}
	const diskNumber64 = readUint32(zip64Record, 16)
	const centralDirectoryDisk64 = readUint32(zip64Record, 20)
	const entriesOnDisk64 = readUint64(zip64Record, 24, "ZIP64 entries on disk")
	const entryCount64 = readUint64(zip64Record, 32, "ZIP64 entry count")
	const centralDirectorySize64 = readUint64(zip64Record, 40, "ZIP64 central-directory size")
	const centralDirectoryOffset64 = readUint64(zip64Record, 48, "ZIP64 central-directory offset")
	if (diskNumber64 !== 0 || centralDirectoryDisk64 !== 0 || entriesOnDisk64 !== entryCount64) {
		throw new Error("Multi-disk ZIP64 archives are not supported by the streaming smoke")
	}
	assertCentralDirectoryBounds(
		file.size,
		centralDirectoryOffset64,
		centralDirectorySize64,
		zip64RecordOffset,
	)

	return {
		archiveType: "zip64",
		centralDirectoryEntryCount: entryCount64,
		centralDirectoryOffset: centralDirectoryOffset64,
		centralDirectorySize: centralDirectorySize64,
		bytesRead:
			tail.byteLength +
			nonOverlappingRangeBytes(
				zip64RecordOffset,
				zip64RecordOffset + zip64Record.byteLength,
				tailStart,
				file.size,
			),
		maxBufferBytes: Math.max(tail.byteLength, zip64Record.byteLength),
	}
}

async function scanCentralDirectory(
	file: Blob,
	centralDirectoryOffset: number,
	centralDirectorySize: number,
	expectedEntryCount: number,
	expectedSlides: number,
	chunkBytes: number,
): Promise<{
	centralDirectoryEntryCount: number
	slideXmlCount: number
	missingSlideNumbers: number[]
	bytesRead: number
	maxBufferBytes: number
}> {
	const decoder = new TextDecoder()
	const slideNumbers = new Set<number>()
	const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize
	let pending = new Uint8Array(0)
	let parsedEntries = 0
	let bytesRead = 0
	let maxBufferBytes = 0

	for (
		let readOffset = centralDirectoryOffset;
		readOffset < centralDirectoryEnd && parsedEntries < expectedEntryCount;
		readOffset += chunkBytes
	) {
		const chunk = await readBlobRange(
			file,
			readOffset,
			Math.min(readOffset + chunkBytes, centralDirectoryEnd),
		)
		bytesRead += chunk.byteLength
		const buffer = concatenateBytes(pending, chunk)
		maxBufferBytes = Math.max(maxBufferBytes, buffer.byteLength)
		let offset = 0

		while (parsedEntries < expectedEntryCount) {
			if (buffer.byteLength - offset < CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES) break
			if (readUint32(buffer, offset) !== CENTRAL_DIRECTORY_ENTRY_SIGNATURE) {
				throw new Error(
					`Invalid central-directory entry signature at entry ${parsedEntries + 1}`,
				)
			}
			const fileNameLength = readUint16(buffer, offset + 28)
			const extraLength = readUint16(buffer, offset + 30)
			const commentLength = readUint16(buffer, offset + 32)
			const entryLength =
				CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES + fileNameLength + extraLength + commentLength
			if (entryLength > MAX_CENTRAL_DIRECTORY_ENTRY_BYTES) {
				throw new Error(`Central-directory entry ${parsedEntries + 1} is too large`)
			}
			if (buffer.byteLength - offset < entryLength) break

			const name = decoder.decode(
				buffer.subarray(
					offset + CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES,
					offset + CENTRAL_DIRECTORY_ENTRY_HEADER_BYTES + fileNameLength,
				),
			)
			const slideMatch = name.match(/^ppt\/slides\/slide(\d+)\.xml$/)
			if (slideMatch) slideNumbers.add(Number(slideMatch[1]))
			parsedEntries += 1
			offset += entryLength
		}

		pending = buffer.slice(offset)
		if (pending.byteLength > MAX_CENTRAL_DIRECTORY_ENTRY_BYTES) {
			throw new Error("Central-directory parser retained an oversized partial entry")
		}
	}

	if (parsedEntries !== expectedEntryCount) {
		throw new Error(
			`Central directory exposed ${parsedEntries} entries; expected ${expectedEntryCount}`,
		)
	}

	const missingSlideNumbers: number[] = []
	for (let index = 1; index <= expectedSlides; index += 1) {
		if (!slideNumbers.has(index)) missingSlideNumbers.push(index)
	}

	return {
		centralDirectoryEntryCount: parsedEntries,
		slideXmlCount: slideNumbers.size,
		missingSlideNumbers,
		bytesRead,
		maxBufferBytes,
	}
}

function findEndOfCentralDirectory(tail: Uint8Array): number {
	for (let offset = tail.byteLength - END_OF_CENTRAL_DIRECTORY_BYTES; offset >= 0; offset -= 1) {
		if (readUint32(tail, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue
		const commentLength = readUint16(tail, offset + 20)
		if (offset + END_OF_CENTRAL_DIRECTORY_BYTES + commentLength === tail.byteLength) {
			return offset
		}
	}
	return -1
}

function assertCentralDirectoryBounds(
	fileBytes: number,
	offset: number,
	size: number,
	directoryLimit: number,
): void {
	if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size)) {
		throw new Error("ZIP central-directory bounds exceed JavaScript safe integers")
	}
	const end = offset + size
	if (!Number.isSafeInteger(end) || offset < 0 || size < 0 || end > fileBytes) {
		throw new Error("ZIP central-directory range is outside the file")
	}
	if (end > directoryLimit) {
		throw new Error("ZIP central directory overlaps its end record")
	}
}

function nonOverlappingRangeBytes(
	start: number,
	end: number,
	existingStart: number,
	existingEnd: number,
): number {
	const overlapStart = Math.max(start, existingStart)
	const overlapEnd = Math.min(end, existingEnd)
	return end - start - Math.max(0, overlapEnd - overlapStart)
}

async function readBlobRange(file: Blob, start: number, end: number): Promise<Uint8Array> {
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		start < 0 ||
		end < start ||
		end > file.size
	) {
		throw new RangeError(`Invalid Blob range ${start}..${end} for ${file.size} bytes`)
	}
	return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

function concatenateBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
	if (left.byteLength === 0) return right
	if (right.byteLength === 0) return left
	const combined = new Uint8Array(left.byteLength + right.byteLength)
	combined.set(left, 0)
	combined.set(right, left.byteLength)
	return combined
}

function readUint16(bytes: Uint8Array, offset: number): number {
	assertReadable(bytes, offset, 2)
	return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function readUint32(bytes: Uint8Array, offset: number): number {
	assertReadable(bytes, offset, 4)
	return (
		(bytes[offset]! |
			(bytes[offset + 1]! << 8) |
			(bytes[offset + 2]! << 16) |
			(bytes[offset + 3]! << 24)) >>>
		0
	)
}

function readUint64(bytes: Uint8Array, offset: number, label: string): number {
	const low = readUint32(bytes, offset)
	const high = readUint32(bytes, offset + 4)
	const value = high * 0x1_0000_0000 + low
	if (!Number.isSafeInteger(value)) {
		throw new Error(`${label} exceeds JavaScript safe integers`)
	}
	return value
}

function assertReadable(bytes: Uint8Array, offset: number, length: number): void {
	if (offset < 0 || offset + length > bytes.byteLength) {
		throw new Error(`Cannot read ${length} bytes at offset ${offset}`)
	}
}

function readPositiveSafeInteger(
	value: number | undefined,
	fallback: number,
	label: string,
): number {
	const resolved = value ?? fallback
	if (!Number.isSafeInteger(resolved) || resolved <= 0) {
		throw new RangeError(`${label} must be a positive safe integer`)
	}
	return resolved
}

function elapsedMs(startedAt: number, endedAt: number): number {
	return Math.max(0, endedAt - startedAt)
}

const SHA256_INITIAL_STATE = new Uint32Array([
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const SHA256_ROUND_CONSTANTS = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export class IncrementalSha256 {
	private readonly state = new Uint32Array(SHA256_INITIAL_STATE)
	private readonly block = new Uint8Array(64)
	private readonly words = new Uint32Array(64)
	private blockLength = 0
	private bytesHashed = 0
	private finished = false

	update(input: Uint8Array): void {
		if (this.finished) throw new Error("SHA-256 digest has already been finalized")
		if (input.byteLength === 0) return
		this.bytesHashed += input.byteLength
		if (!Number.isSafeInteger(this.bytesHashed)) {
			throw new RangeError("SHA-256 input length exceeds JavaScript safe integers")
		}

		let offset = 0
		if (this.blockLength > 0) {
			const copied = Math.min(64 - this.blockLength, input.byteLength)
			this.block.set(input.subarray(0, copied), this.blockLength)
			this.blockLength += copied
			offset = copied
			if (this.blockLength === 64) {
				this.compress(this.block, 0)
				this.blockLength = 0
			}
		}

		while (offset + 64 <= input.byteLength) {
			this.compress(input, offset)
			offset += 64
		}
		if (offset < input.byteLength) {
			this.block.set(input.subarray(offset), 0)
			this.blockLength = input.byteLength - offset
		}
	}

	digestHex(): string {
		const digest = this.digest()
		return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
	}

	private digest(): Uint8Array {
		if (this.finished) throw new Error("SHA-256 digest has already been finalized")
		this.finished = true
		const bitLengthLow = (this.bytesHashed * 8) >>> 0
		const bitLengthHigh = Math.floor(this.bytesHashed / 0x20000000) >>> 0

		this.block[this.blockLength] = 0x80
		this.blockLength += 1
		if (this.blockLength > 56) {
			this.block.fill(0, this.blockLength, 64)
			this.compress(this.block, 0)
			this.blockLength = 0
		}
		this.block.fill(0, this.blockLength, 56)
		writeUint32BigEndian(this.block, 56, bitLengthHigh)
		writeUint32BigEndian(this.block, 60, bitLengthLow)
		this.compress(this.block, 0)

		const output = new Uint8Array(32)
		for (let index = 0; index < this.state.length; index += 1) {
			writeUint32BigEndian(output, index * 4, this.state[index]!)
		}
		return output
	}

	private compress(input: Uint8Array, offset: number): void {
		for (let index = 0; index < 16; index += 1) {
			const wordOffset = offset + index * 4
			this.words[index] =
				((input[wordOffset]! << 24) |
					(input[wordOffset + 1]! << 16) |
					(input[wordOffset + 2]! << 8) |
					input[wordOffset + 3]!) >>>
				0
		}
		for (let index = 16; index < 64; index += 1) {
			const value15 = this.words[index - 15]!
			const value2 = this.words[index - 2]!
			const sigma0 = rotateRight(value15, 7) ^ rotateRight(value15, 18) ^ (value15 >>> 3)
			const sigma1 = rotateRight(value2, 17) ^ rotateRight(value2, 19) ^ (value2 >>> 10)
			this.words[index] =
				(this.words[index - 16]! + sigma0 + this.words[index - 7]! + sigma1) >>> 0
		}

		let a = this.state[0]!
		let b = this.state[1]!
		let c = this.state[2]!
		let d = this.state[3]!
		let e = this.state[4]!
		let f = this.state[5]!
		let g = this.state[6]!
		let h = this.state[7]!

		for (let index = 0; index < 64; index += 1) {
			const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
			const choose = (e & f) ^ (~e & g)
			const temp1 =
				(h + sum1 + choose + SHA256_ROUND_CONSTANTS[index]! + this.words[index]!) >>> 0
			const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
			const majority = (a & b) ^ (a & c) ^ (b & c)
			const temp2 = (sum0 + majority) >>> 0
			h = g
			g = f
			f = e
			e = (d + temp1) >>> 0
			d = c
			c = b
			b = a
			a = (temp1 + temp2) >>> 0
		}

		this.state[0] = (this.state[0]! + a) >>> 0
		this.state[1] = (this.state[1]! + b) >>> 0
		this.state[2] = (this.state[2]! + c) >>> 0
		this.state[3] = (this.state[3]! + d) >>> 0
		this.state[4] = (this.state[4]! + e) >>> 0
		this.state[5] = (this.state[5]! + f) >>> 0
		this.state[6] = (this.state[6]! + g) >>> 0
		this.state[7] = (this.state[7]! + h) >>> 0
	}
}

function rotateRight(value: number, bits: number): number {
	return (value >>> bits) | (value << (32 - bits))
}

function writeUint32BigEndian(bytes: Uint8Array, offset: number, value: number): void {
	bytes[offset] = value >>> 24
	bytes[offset + 1] = value >>> 16
	bytes[offset + 2] = value >>> 8
	bytes[offset + 3] = value
}
