export type UploadedImage = {
	path: string
	url: string
}

export type UploadFileOptions = {
	storage: "public" | "private"
	directory?: string
	signal?: AbortSignal
}

export type UploadedFile = {
	path: string
	url?: string
}

export type Capabilities = {
	uploadPublicImage(file: File, options?: { signal?: AbortSignal }): Promise<UploadedImage>
	uploadFile(file: File, options: UploadFileOptions): Promise<UploadedFile>
}
