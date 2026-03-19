import Recorder from "./recorder/recorder"
import { safeBinaryToBtoa } from "@/utils/encoding"

export const recorder = new Recorder({
	sampleBits: 16, // 采样位数，支持 8 或 16，默认是16
	sampleRate: 16000, // 采样率，支持 11025、16000、22050、24000、44100、48000，根据浏览器默认值，我的chrome是48000
	numChannels: 1, // 声道，支持 1 或 2， 默认是1
	// compiling: false,(0.x版本中生效,1.x增加中)  // 是否边录边转换，默认是false
})

export async function startRecording() {
	await recorder.start()
}

export function stopRecording() {
	recorder.stop()
}

// 补充零，确保两位数
function pad(num: number): string {
	return num < 10 ? `0${num}` : `${num}`
}

export function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600) // 计算小时
	const minutes = Math.floor((seconds % 3600) / 60) // 计算分钟
	const remainingSeconds = Math.floor(seconds % 60) // 剩余的秒数

	// 格式化为 HH:MM:SS 的形式，确保每个部分都是两位数
	return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
}

/**
 * 将 Blob 或 Uint8Array 转换为 Base64 字符串
 * @param input - 需要转换的 Blob 或 Uint8Array 对象
 * @returns Promise<string> - Base64 字符串
 */
export async function blobToBase64Async(input: Blob | Uint8Array): Promise<string> {
	if (input instanceof Blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onloadend = () => {
				if (reader.result && typeof reader.result === "string") {
					// 从 DataURL 中提取 Base64 部分
					resolve(reader.result.split(",")[1])
				} else {
					reject(new Error("Failed to convert Blob to Base64"))
				}
			}

			reader.onerror = () => reject(new Error("Error reading Blob as Base64"))

			reader.readAsDataURL(input)
		})
	}
	if (input instanceof Uint8Array) {
		// Uint8Array 转 Base64
		return new Promise((resolve) => {
			const base64Result = safeBinaryToBtoa(input)
			resolve(base64Result)
		})
	}
	throw new Error("Unsupported input type. Only Blob or Uint8Array is allowed.")
}
