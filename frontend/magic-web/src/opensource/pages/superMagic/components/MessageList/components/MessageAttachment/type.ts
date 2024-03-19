export interface AttachmentProps {
	file_extension: string | undefined
	file_name: string
	filename: string
	contentLength: number
	url: string
	file_id: string
	display_filename?: string
	metadata?: {
		version: string
		type: string
		name: string
		slides?: string[]
	}
}
