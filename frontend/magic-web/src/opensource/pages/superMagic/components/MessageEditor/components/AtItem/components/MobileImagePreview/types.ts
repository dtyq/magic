export interface MobileImagePreviewProps {
	src?: string
	alt?: string
	visible?: boolean
	onClose?: () => void
}

export interface MobileImagePreviewRef {
	show: (options: { src?: string; alt?: string; file_id?: string; file?: File }) => void
	hide: () => void
}
