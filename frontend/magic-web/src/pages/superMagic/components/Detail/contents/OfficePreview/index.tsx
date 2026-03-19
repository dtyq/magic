import type { DetailUniverData } from "../../types"
import { DetailType } from "../../types"

interface OfficePreviewProps {
	data: DetailUniverData
	type: DetailType
	file_extension?: string
	[key: string]: any // 允许接收其他展开的 props
}

function OfficePreview({ data, type, file_extension, ...commonProps }: OfficePreviewProps) {
	return null
}

export default OfficePreview
