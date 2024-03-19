import * as buffer from "buffer"
import { InitException, InitExceptionCode } from "../Exception/InitException"
import type { Checkpoint } from "../types"
import type { ErrorType } from "../types/error"
import { isBlob, isFile } from "./checkDataFormat"

export function parallelSend(
	todo: number[],
	parallel: number,
	jobPromise: (value: number) => Promise<void>,
): Promise<ErrorType.UploadPartException[]> {
	return new Promise((resolve) => {
		const jobErr: ErrorType.UploadPartException[] = []
		if (parallel <= 0 || !todo) {
			resolve(jobErr)
			return
		}

		function onlyOnce(fn: Function | null) {
			return (...args: ErrorType.UploadPartException[]) => {
				if (fn === null) throw new Error("Callback was already called.")
				const callFn = fn
				// eslint-disable-next-line no-param-reassign
				fn = null
				callFn.apply("", args)
			}
		}

		function createArrayIterator(coll: number[]) {
			let i = -1
			const len = coll.length
			return function next() {
				// eslint-disable-next-line no-plusplus
				return ++i < len ? { value: coll[i], key: i } : null
			}
		}

		const nextElem = createArrayIterator(todo)
		let done = false
		let running = 0
		let looping = false

		function iteratee(value: number, callback: Function) {
			jobPromise(value)
				.then((result) => {
					callback(null, result)
				})
				.catch((err) => {
					callback(err)
				})
		}

		function iterateeCallback(err: ErrorType.UploadPartException) {
			running -= 1
			if (err) {
				done = true
				jobErr.push(err)
				resolve(jobErr)
			} else if (done && running <= 0) {
				done = true
				resolve(jobErr)
			} else if (!looping) {
				// eslint-disable-next-line @typescript-eslint/no-use-before-define
				replenish()
			}
		}
		function replenish() {
			looping = true
			while (running < parallel && !done) {
				const elem = nextElem()
				if (elem === null || jobErr.length > 0) {
					done = true
					if (running <= 0) {
						resolve(jobErr)
					}
					return
				}
				running += 1
				iteratee(elem.value, onlyOnce(iterateeCallback))
			}
			looping = false
		}

		replenish()
	})
}

export function divideParts(fileSize: number, partSize: number) {
	const numParts = Math.ceil(fileSize / partSize)
	const partOffs = []
	for (let i = 0; i < numParts; i += 1) {
		const start = partSize * i
		const end = Math.min(start + partSize, fileSize)

		partOffs.push({
			start,
			end,
		})
	}
	return partOffs
}

export function getBuffer(file: File | Blob): Promise<string | ArrayBuffer> {
	// Some browsers do not support Blob.prototype.arrayBuffer, such as IE
	return new Promise((resolve, reject) => {
		if (file.arrayBuffer) {
			resolve(file.arrayBuffer())
		}
		const reader = new FileReader()
		reader.onload = (e) => {
			if (e?.target) {
				if (e.target.result !== null) {
					resolve(e.target.result)
				}
			}
		}
		reader.onerror = (e) => {
			reject(e)
		}
		reader.readAsArrayBuffer(file)
	})
}

export async function createBuffer(file: File | Blob, start: number, end: number) {
	if (isBlob(file) || isFile(file)) {
		const tempFile = file.slice(start, end)
		const fileContent = await getBuffer(tempFile)
		if (typeof fileContent === "string") {
			return buffer.Buffer.from(fileContent)
		}
		return buffer.Buffer.from(new Uint8Array(fileContent))
	}
	throw new InitException(InitExceptionCode.UPLOAD_HEAD_NO_EXPOSE_ETAG)
}

export function getPartSize(
	fileSize: number,
	partSize: number,
	defaultPartSize: number = 1024 * 1024,
) {
	const maxNumParts = 10 * 1000
	let tempPartSize = partSize || defaultPartSize
	const safeSize = Math.ceil(fileSize / maxNumParts)

	if (partSize < safeSize) {
		tempPartSize = safeSize
		// eslint-disable-next-line no-console
		console.warn(
			"partSize has been set to ".concat(
				String(tempPartSize),
				", because the partSize you provided causes partNumber to be greater than 10,000",
			),
		)
	}

	return tempPartSize
}

export function initCheckpoint(
	file: File | Blob,
	name: string,
	fileSize: number,
	partSize: number,
	uploadId: string,
): Checkpoint {
	return {
		file,
		name,
		fileSize,
		partSize,
		uploadId,
		doneParts: [],
	}
}
