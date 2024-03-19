import { nanoid } from "nanoid"
import type { Upload } from "@/types/upload"

export function genFileData(file: File): Upload.FileData {
	return {
		id: nanoid(),
		name: file.name,
		size: file.size,
		file,
		status: "init",
		progress: 0,
	}
}
