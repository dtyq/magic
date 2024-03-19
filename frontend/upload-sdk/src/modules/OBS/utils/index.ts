export const OBS_MIN_PART_SIZE = 100 * 1024

export function genCompleteMultipartUploadXMLData(
	completeParts: { PartNumber: number; ETag: string }[],
) {
	const xmlData = document.createElementNS("", "Data")
	const CompleteMultipartUpload = document.createElementNS("", "CompleteMultipartUpload")
	completeParts.forEach((item) => {
		const Part = document.createElementNS("", "Part")
		const PartNumber = document.createElementNS("", "PartNumber")
		const ETag = document.createElementNS("", "ETag")
		PartNumber.innerHTML = `${item.PartNumber}`
		ETag.innerHTML = item.ETag.replace('"', "").replace('"', "")
		Part.appendChild(PartNumber)
		Part.appendChild(ETag)
		CompleteMultipartUpload.appendChild(Part)
	})

	xmlData.appendChild(CompleteMultipartUpload)

	return xmlData.innerHTML
}
