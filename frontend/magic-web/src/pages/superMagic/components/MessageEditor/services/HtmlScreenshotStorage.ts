import { nanoid } from "nanoid"
import { base64ToFile } from "../utils/fileConverter"
import { htmlScreenshotDatabase } from "./HtmlScreenshotDatabase"

export interface StoredHtmlScreenshot {
	storageId: string
	fileName: string
	fileSize: number
	file: File
}

/** Persist inspector screenshots by capture id. */
class HtmlScreenshotStorage {
	async store(
		dataUrl: string,
		fileName: string,
		captureId?: string,
	): Promise<StoredHtmlScreenshot> {
		const file = await base64ToFile(dataUrl, fileName)
		const storageId = captureId || nanoid()
		await htmlScreenshotDatabase.put(storageId, file)
		return { storageId, fileName: file.name, fileSize: file.size, file }
	}

	getBlob(storageId: string): Promise<Blob | null> {
		return htmlScreenshotDatabase.get(storageId)
	}

	delete(storageId: string): Promise<void> {
		return htmlScreenshotDatabase.delete(storageId)
	}
}

export const htmlScreenshotStorage = new HtmlScreenshotStorage()
