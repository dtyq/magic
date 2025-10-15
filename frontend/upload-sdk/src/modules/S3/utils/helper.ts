import type { S3 } from "../../../types/S3"

/**
 * Build S3 URL from bucket, key and endpoint
 */
export function buildS3Url(
	bucket: string,
	key: string,
	endpoint: string,
	pathStyle: boolean = false,
): string {
	const cleanEndpoint = endpoint.replace(/\/$/, "")
	const encodedKey = key.split("/").map(encodeURIComponent).join("/")

	if (pathStyle) {
		// Path-style: http://endpoint/bucket/key
		return `${cleanEndpoint}/${bucket}/${encodedKey}`
	}

	// Virtual-hosted-style: http://bucket.endpoint/key
	// For MinIO and some S3-compatible services, we might need to use path-style
	const urlObj = new URL(cleanEndpoint)
	const protocol = urlObj.protocol
	const host = urlObj.host

	return `${protocol}//${bucket}.${host}/${encodedKey}`
}

/**
 * Parse XML response from S3
 */
export function parseXmlResponse(xmlString: string): any {
	// Simple XML parser for basic S3 responses
	const parser = new DOMParser()
	const xmlDoc = parser.parseFromString(xmlString, "text/xml")

	const parseNode = (node: Element): any => {
		const result: any = {}

		// If node has children, parse them
		if (node.children.length > 0) {
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i]
				if (!child) continue

				const childName = child.nodeName
				const childValue = parseNode(child)

				if (result[childName]) {
					// Handle multiple children with same name
					if (Array.isArray(result[childName])) {
						result[childName].push(childValue)
					} else {
						result[childName] = [result[childName], childValue]
					}
				} else {
					result[childName] = childValue
				}
			}
			return result
		}

		// If node is leaf, return text content
		return node.textContent || ""
	}

	return parseNode(xmlDoc.documentElement)
}

/**
 * Build complete multipart upload XML payload
 */
export function buildCompleteMultipartXml(parts: S3.DonePart[]): string {
	const sortedParts = parts
		.concat()
		.sort((a, b) => a.number - b.number)
		.filter((item, index, arr) => {
			const prevItem = arr[index - 1]
			return !index || (prevItem && item.number !== prevItem.number)
		})

	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
	xml += "<CompleteMultipartUpload>\n"

	for (const part of sortedParts) {
		xml += "  <Part>\n"
		xml += `    <PartNumber>${part.number}</PartNumber>\n`
		xml += `    <ETag>${part.etag}</ETag>\n`
		xml += "  </Part>\n"
	}

	xml += "</CompleteMultipartUpload>"

	return xml
}

/**
 * Remove protocol from URL
 */
export function removeProtocol(url: string): string {
	return url.replace(/^https?:\/\//, "")
}

/**
 * Extract bucket and key from S3 URL
 */
export function parseS3Url(url: string): { bucket: string; key: string; endpoint: string } | null {
	try {
		const urlObj = new URL(url)
		const pathParts = urlObj.pathname.split("/").filter(Boolean)

		// Check if path-style URL
		if (pathParts.length >= 2) {
			const bucket = pathParts[0]
			const key = pathParts.slice(1).join("/")
			const endpoint = `${urlObj.protocol}//${urlObj.host}`
			if (bucket && key && endpoint) {
				return { bucket, key, endpoint }
			}
		}

		// Check if virtual-hosted-style URL
		const hostParts = urlObj.host.split(".")
		if (hostParts.length >= 2) {
			const bucket = hostParts[0]
			const key = pathParts.join("/")
			const endpoint = `${urlObj.protocol}//${hostParts.slice(1).join(".")}`
			if (bucket && endpoint) {
				return { bucket, key, endpoint }
			}
		}
	} catch (e) {
		// Invalid URL
	}

	return null
}

