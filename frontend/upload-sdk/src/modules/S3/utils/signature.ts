import CryptoJS from "crypto-js"

/**
 * AWS Signature V4 implementation for S3
 * Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 */

/**
 * Get ISO8601 formatted date string
 */
export function getAmzDate(date: Date = new Date()): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

/**
 * Get date string in YYYYMMDD format
 */
export function getDateStamp(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10).replace(/-/g, "")
}

/**
 * Calculate SHA256 hash
 */
export function sha256(data: string): string {
	return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex)
}

/**
 * Calculate HMAC-SHA256
 */
function hmacSha256(key: CryptoJS.lib.WordArray | string, data: string): CryptoJS.lib.WordArray {
	return CryptoJS.HmacSHA256(data, key)
}

/**
 * Get AWS Signature V4 signing key
 */
function getSignatureKey(
	secretAccessKey: string,
	dateStamp: string,
	region: string,
	service: string = "s3",
): CryptoJS.lib.WordArray {
	const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
	const kRegion = hmacSha256(kDate, region)
	const kService = hmacSha256(kRegion, service)
	const kSigning = hmacSha256(kService, "aws4_request")
	return kSigning
}

/**
 * Build canonical query string
 */
export function buildCanonicalQueryString(query: Record<string, string | number>): string {
	const keys = Object.keys(query).sort()
	return keys
		.map((key) => {
			const value = query[key]
			return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
		})
		.join("&")
}

/**
 * Build canonical headers string
 */
export function buildCanonicalHeaders(headers: Record<string, string>): string {
	const keys = Object.keys(headers)
		.map((k) => k.toLowerCase())
		.sort()
	return keys
		.map((key) => {
			const value = headers[key]
			return value ? `${key}:${value.trim()}\n` : `${key}:\n`
		})
		.join("")
}

/**
 * Get signed headers string
 */
export function getSignedHeaders(headers: Record<string, string>): string {
	return Object.keys(headers)
		.map((k) => k.toLowerCase())
		.sort()
		.join(";")
}

/**
 * Build canonical request
 */
export function buildCanonicalRequest(
	method: string,
	canonicalUri: string,
	canonicalQueryString: string,
	canonicalHeaders: string,
	signedHeaders: string,
	payloadHash: string,
): string {
	return [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join(
		"\n",
	)
}

/**
 * Build string to sign
 */
export function buildStringToSign(
	amzDate: string,
	credentialScope: string,
	canonicalRequestHash: string,
): string {
	return ["AWS4-HMAC-SHA256", amzDate, credentialScope, canonicalRequestHash].join("\n")
}

/**
 * Sign request with AWS Signature V4
 */
export interface SignRequestParams {
	method: string
	url: string
	headers: Record<string, string>
	query?: Record<string, string | number>
	body?: string | ArrayBuffer | Blob | File
	accessKeyId: string
	secretAccessKey: string
	sessionToken?: string
	region: string
	service?: string
	payloadHash?: string
}

export async function signRequest(params: SignRequestParams): Promise<Record<string, string>> {
	const {
		method,
		url,
		headers,
		query = {},
		body,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		service = "s3",
		payloadHash,
	} = params

	const urlObj = new URL(url)
	const host = urlObj.host
	const canonicalUri = urlObj.pathname || "/"
	const date = new Date()
	const amzDate = getAmzDate(date)
	const dateStamp = getDateStamp(date)

	// Calculate payload hash
	let contentHash = payloadHash || "UNSIGNED-PAYLOAD"
	if (!payloadHash && body) {
		if (typeof body === "string") {
			contentHash = sha256(body)
		} else if (body instanceof ArrayBuffer) {
			const uint8Array = new Uint8Array(body)
			const wordArray = CryptoJS.lib.WordArray.create(uint8Array as any)
			contentHash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex)
		}
		// For Blob/File, use UNSIGNED-PAYLOAD as calculating hash would require reading the entire file
	}

	// Build headers
	const requestHeaders: Record<string, string> = {
		...headers,
		host,
		"x-amz-date": amzDate,
		"x-amz-content-sha256": contentHash,
	}

	if (sessionToken) {
		requestHeaders["x-amz-security-token"] = sessionToken
	}

	// Build canonical request
	const canonicalQueryString = buildCanonicalQueryString(query)
	const canonicalHeaders = buildCanonicalHeaders(requestHeaders)
	const signedHeaders = getSignedHeaders(requestHeaders)
	const canonicalRequest = buildCanonicalRequest(
		method,
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		contentHash,
	)

	// Build string to sign
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
	const canonicalRequestHash = sha256(canonicalRequest)
	const stringToSign = buildStringToSign(amzDate, credentialScope, canonicalRequestHash)

	// Calculate signature
	const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service)
	const signature = hmacSha256(signingKey, stringToSign).toString(CryptoJS.enc.Hex)

	// Build authorization header
	const authorizationHeader = [
		`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
		`SignedHeaders=${signedHeaders}`,
		`Signature=${signature}`,
	].join(", ")

	requestHeaders.authorization = authorizationHeader

	return requestHeaders
}

/**
 * Generate pre-signed URL for S3 GET/PUT operations
 */
export interface PreSignUrlParams {
	method: string
	bucket: string
	key: string
	endpoint: string
	accessKeyId: string
	secretAccessKey: string
	sessionToken?: string
	region: string
	expiresIn?: number
	pathStyle?: boolean
}

export function generatePreSignedUrl(params: PreSignUrlParams): string {
	const {
		method,
		bucket,
		key,
		endpoint,
		accessKeyId,
		secretAccessKey,
		sessionToken,
		region,
		expiresIn = 3600,
		pathStyle = false,
	} = params

	const date = new Date()
	const amzDate = getAmzDate(date)
	const dateStamp = getDateStamp(date)
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

	// Build URL
	const endpointUrl = endpoint.replace(/\/$/, "")
	const encodedKey = key.split("/").map(encodeURIComponent).join("/")
	const url = pathStyle
		? `${endpointUrl}/${bucket}/${encodedKey}`
		: `${endpointUrl}/${encodedKey}`

	// Build query parameters
	const queryParams: Record<string, string> = {
		"X-Amz-Algorithm": "AWS4-HMAC-SHA256",
		"X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
		"X-Amz-Date": amzDate,
		"X-Amz-Expires": String(expiresIn),
		"X-Amz-SignedHeaders": "host",
	}

	if (sessionToken) {
		queryParams["X-Amz-Security-Token"] = sessionToken
	}

	// Build canonical request
	const urlObj = new URL(url)
	const canonicalUri = urlObj.pathname
	const canonicalQueryString = buildCanonicalQueryString(queryParams)
	const canonicalHeaders = `host:${urlObj.host}\n`
	const signedHeaders = "host"
	const payloadHash = "UNSIGNED-PAYLOAD"

	const canonicalRequest = buildCanonicalRequest(
		method,
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	)

	// Build string to sign
	const canonicalRequestHash = sha256(canonicalRequest)
	const stringToSign = buildStringToSign(amzDate, credentialScope, canonicalRequestHash)

	// Calculate signature
	const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, "s3")
	const signature = hmacSha256(signingKey, stringToSign).toString(CryptoJS.enc.Hex)

	// Build final URL
	queryParams["X-Amz-Signature"] = signature
	const finalQueryString = buildCanonicalQueryString(queryParams)

	return `${url}?${finalQueryString}`
}

