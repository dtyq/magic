import { hashSha256, hmacSha256, parse, stringify } from "./universal/crypto.browser"
import { getSortedQueryString } from "./utils"

export interface ISign {
	signature(opt: ISigOptions, expiredAt: number, credentials?: ISigCredentials): string

	signatureHeader(
		opt: ISigOptions,
		expiredAt?: number,
		credentials?: ISigCredentials,
	): Map<string, string>

	getSignatureQuery(opt: ISigOptions, expiredAt: number): { [key: string]: any }
}

export interface ISigCredentials {
	GetSecretKey(): string

	GetAccessKey(): string
}

export interface ISigPolicyQuery {
	policy: {
		conditions: (string[] | { bucket: string } | { key: string })[]
	}
	datetime?: string
	query?: string
	path?: string
	method?: string
	headers?: { [key: string]: string | undefined }
}

export interface ISigOptions {
	sigName?: string
	endpoints?: string
	bucket?: string
	headers?: { [key: string]: string | undefined }
	region?: string
	serviceName?: string
	algorithm?: string
	path: string
	method: string
	query?: string | Record<string, any>
	datetime?: string
	host?: string
	port?: number
}

export interface ISigQueryOptions extends Omit<ISigOptions, "query"> {
	query?: Record<string, any>
}

export const SIG_QUERY = {
	algorithm: "tos-algorithm",
	expiration: "tos-expiration",
	signame: "tos-signame",
	signature: "tos-signature",

	v4_algorithm: "X-Tos-Algorithm",
	v4_credential: "X-Tos-Credential",
	v4_date: "X-Tos-Date",
	v4_expires: "X-Tos-Expires",
	v4_signedHeaders: "X-Tos-SignedHeaders",
	v4_security_token: "X-Tos-Security-Token",
	v4_signature: "X-Tos-Signature",
	v4_content_sha: "X-Tos-Content-Sha256",
	v4_policy: "X-Tos-Policy",
}

export function isDefaultPort(port?: number) {
	if (port && port !== 80 && port !== 443) {
		return false
	}
	return true
}

/**
 * @api private
 */
const v4Identifier = "request"

interface ISignV4Opt {
	algorithm?: string
	region?: string
	serviceName?: string
	securityToken?: string
	bucket: string
}

function getNeedSignedHeaders(headers: Record<string, unknown> | undefined) {
	const needSignHeaders: string[] = []
	if (headers) {
		Object.keys(headers).forEach((key: string) => {
			if (key === "host" || key.startsWith("x-tos-")) {
				if (headers[key] != null) {
					needSignHeaders.push(key)
				}
			}
		})
	}
	return needSignHeaders.sort()
}

/**
 * @api private
 */
export class SignersV4 implements ISign {
	private options: ISignV4Opt

	private credentials: ISigCredentials

	constructor(opt: ISignV4Opt, credentials: ISigCredentials) {
		this.options = opt
		this.credentials = credentials
	}

	/**
	 * normal v4 signature
	 * */
	// @ts-ignore
	public signature = (opt: ISigOptions, expiredAt: number, credentials?: ISigCredentials) => {
		if (!credentials) {
			credentials = this.credentials
		}
		const parts: string[] = []
		const datatime = opt.datetime as string
		const credString = this.credentialString(datatime)
		parts.push(
			`${this.options.algorithm} Credential=${credentials.GetAccessKey()}/${credString}`,
		)

		parts.push(`SignedHeaders=${SignersV4.signedHeaders(opt)}`)
		parts.push(`Signature=${this.authorization(opt, credentials, 0)}`)
		return parts.join(", ")
	}

	public signatureHeader = (
		opt: ISigOptions,
		// @ts-ignore
		expiredAt?: number,
		credentials?: ISigCredentials,
	): Map<string, string> => {
		// const datetime = (new Date(new Date().toUTCString())).Format("yyyyMMddTHHmmssZ")
		opt.datetime = SignersV4.getDateTime()
		const header = new Map<string, string>()
		/* istanbul ignore if */
		if (!opt.headers) {
			const h: { [key: string]: string } = {}
			opt.headers = h
		}

		opt.headers.host = `${opt.host}`
		/* istanbul ignore if */
		if (!isDefaultPort(opt.port)) {
			opt.headers.host += `:${opt.port}`
		}
		/* istanbul ignore if */
		if (opt.endpoints) {
			opt.headers.host = `${this.options.bucket}.${opt.endpoints}`
		}

		header.set("host", opt.headers.host)
		header.set("x-tos-date", opt.datetime)
		header.set("x-tos-content-sha256", SignersV4.hexEncodedBodyHash())
		if (this.options.securityToken) {
			header.set("x-tos-security-token", this.options.securityToken)
		}
		// x-tos- must to be signatured
		header.forEach((value, key) => {
			if (key.startsWith("x-tos") && opt.headers) {
				opt.headers[key] = value
			}
		})
		opt.path = SignersV4.getEncodePath(opt.path)
		const sign = this.signature(opt, 0, credentials)
		header.set("authorization", sign)

		return header
	}

	public getSignatureQuery = (opt: ISigOptions, expiredAt: number): { [key: string]: any } => {
		const queryOpt: ISigQueryOptions = {
			...opt,
			query: typeof opt.query === "string" ? {} : (opt.query as Record<string, any>),
		}
		queryOpt.datetime = SignersV4.getDateTime()
		if (!queryOpt.headers) {
			queryOpt.headers = {}
		}

		queryOpt.headers.host = `${queryOpt.host}`
		if (!isDefaultPort(queryOpt.port)) {
			queryOpt.headers.host += `:${queryOpt.port}`
		}

		queryOpt.path = SignersV4.getEncodePath(queryOpt.path)
		if (queryOpt.endpoints) {
			queryOpt.headers.host = `${this.options.bucket}.${queryOpt.endpoints}`
			// opt.path = `${opt.path}`;
		}

		queryOpt.headers[SIG_QUERY.v4_date] = queryOpt.datetime
		const credString = this.credentialString(queryOpt.datetime as string)
		const res = {
			...(queryOpt.query || {}),
			[SIG_QUERY.v4_algorithm]: this.options.algorithm,
			[SIG_QUERY.v4_content_sha]: SignersV4.hexEncodedBodyHash(),
			[SIG_QUERY.v4_credential]: `${this.credentials.GetAccessKey()}/${credString}`,
			[SIG_QUERY.v4_date]: queryOpt.datetime,
			[SIG_QUERY.v4_expires]: `${expiredAt}`,
			[SIG_QUERY.v4_signedHeaders]: SignersV4.signedHeaders(queryOpt),
		}
		if (this.options.securityToken) {
			res[SIG_QUERY.v4_security_token] = this.options.securityToken
		}

		const queryString = getSortedQueryString(res)
		// 保持原有opt的query类型不变
		if (typeof opt.query === "string") {
			opt.query = queryString
		} else {
			opt.query = res
		}

		res[SIG_QUERY.v4_signature] = this.authorization(queryOpt, this.credentials, expiredAt)
		return res
	}

	public getSignaturePolicyQuery = (
		opt: ISigPolicyQuery,
		expiredAt: number,
	): { [key: string]: any } => {
		// 添加ISigOptions必要的属性
		const policyOpt: ISigOptions = {
			...(opt as any),
			path: opt.path || "/",
			method: opt.method || "POST",
			datetime: SignersV4.getDateTime(),
		}

		const credString = this.credentialString(policyOpt.datetime as string)
		const res = {
			[SIG_QUERY.v4_algorithm]: this.options.algorithm,
			[SIG_QUERY.v4_credential]: `${this.credentials.GetAccessKey()}/${credString}`,
			[SIG_QUERY.v4_date]: policyOpt.datetime,
			[SIG_QUERY.v4_expires]: `${expiredAt}`,
			[SIG_QUERY.v4_policy]: stringify(parse(JSON.stringify(opt.policy), "utf-8"), "base64"),
		}
		if (this.options.securityToken) {
			res[SIG_QUERY.v4_security_token] = this.options.securityToken
		}

		// 确保opt有query属性
		opt.query = getSortedQueryString(res)

		res[SIG_QUERY.v4_signature] = this.authorization(policyOpt, this.credentials, expiredAt)
		return res
	}

	static hexEncodedBodyHash = () => {
		return "UNSIGNED-PAYLOAD"
	}

	// @ts-ignore
	private authorization = (opt: ISigOptions, credentials: ISigCredentials, expiredAt: number) => {
		/* istanbul ignore if */
		if (!opt.datetime) {
			return ""
		}

		const signingKey = this.getSigningKey(credentials, opt.datetime.substr(0, 8))
		// console.log(
		// 'signingKey:',
		//  signingKey,
		//  'sign:',
		//  this.stringToSign(opt.datetime, opt)
		//  );
		return hmacSha256(signingKey, this.stringToSign(opt.datetime, opt), "hex")
	}

	static getDateTime = () => {
		const date = new Date(new Date().toUTCString())
		return `${date.toISOString().replace(/\..+/, "").replace(/-/g, "").replace(/:/g, "")}Z`
	}

	private credentialString = (datetime: string) => {
		return SignersV4.createScope(
			datetime.substr(0, 8),
			this.options.region,
			this.options.serviceName,
		)
	}

	static createScope = (date: string, region?: string, serviceName?: string) => {
		return [date.substr(0, 8), region, serviceName, v4Identifier].join("/")
	}

	private getSigningKey = (credentials: ISigCredentials, date: string) => {
		const kDate = hmacSha256(credentials.GetSecretKey(), date)
		const kRegion = hmacSha256(kDate, this.options.region as string)
		const kService = hmacSha256(kRegion, this.options.serviceName as string)
		const signingKey = hmacSha256(kService, v4Identifier)

		return signingKey
	}

	private stringToSign = (datetime: string, opt: ISigOptions) => {
		/* istanbul ignore if */
		if (!this.options.algorithm) {
			return ""
		}

		const parts: string[] = []
		parts.push(this.options.algorithm)
		parts.push(datetime)
		parts.push(this.credentialString(datetime))
		const canonicalString =
			"policy" in opt ? SignersV4.canonicalStringPolicy(opt) : SignersV4.canonicalString(opt)
		parts.push(SignersV4.hexEncodedHash(canonicalString))
		return parts.join("\n")
	}

	static hexEncodedHash = (string: string) => {
		return hashSha256(string, "hex")
	}

	static canonicalString = (opt: ISigOptions) => {
		const parts: any[] = []
		parts.push(opt.method)
		parts.push(opt.path)
		parts.push(SignersV4.getEncodePath(opt.query as string, false))
		parts.push(`${SignersV4.canonicalHeaders(opt)}\n`)
		parts.push(SignersV4.signedHeaders(opt))
		parts.push(SignersV4.hexEncodedBodyHash())
		return parts.join("\n")
	}

	static canonicalStringPolicy = (opt: ISigOptions) => {
		const parts: any[] = []
		parts.push(SignersV4.getEncodePath(opt.query as string, false))
		parts.push(SignersV4.hexEncodedBodyHash())
		return parts.join("\n")
	}

	static canonicalHeaders = (opt: ISigOptions) => {
		const parts: string[] = []
		const needSignHeaders = getNeedSignedHeaders(opt.headers)

		// eslint-disable-next-line no-restricted-syntax
		for (const key of needSignHeaders) {
			const value = opt.headers?.[key]
			parts.push(
				`${key.toLowerCase()}:${SignersV4.canonicalHeaderValues(value?.toString() || "")}`,
			)
		}

		return parts.join("\n")
	}

	static canonicalHeaderValues = (values: string) => {
		return values.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "")
	}

	static signedHeaders = (opt: ISigOptions) => {
		const keys: string[] = []
		const needSignHeaders = getNeedSignedHeaders(opt.headers)

		// eslint-disable-next-line no-restricted-syntax
		for (const key of needSignHeaders) {
			keys.push(key.toLowerCase())
		}

		return keys.sort().join(";")
	}

	/**
	 * ! * ' () aren't transformed by encodeUrl, so they need be handled
	 */
	static getEncodePath(path: string, encodeAll: boolean = true): string {
		if (!path) {
			return ""
		}

		let tmpPath = path
		if (encodeAll) {
			tmpPath = path.replace(/%2F/g, "/")
		}
		tmpPath = tmpPath.replace(/\(/g, "%28")
		tmpPath = tmpPath.replace(/\)/g, "%29")
		tmpPath = tmpPath.replace(/!/g, "%21")
		tmpPath = tmpPath.replace(/\*/g, "%2A")
		tmpPath = tmpPath.replace(/'/g, "%27")
		return tmpPath
	}
}
