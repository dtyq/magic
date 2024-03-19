import type { ISigCredentials } from "./signatureV4"

export class SignatureV4Credentials implements ISigCredentials {
	public securityToken: string

	public secretAccessKey: string

	public accessKeyId: string

	constructor(securityToken?: string, secretAccessKey?: string, accessKeyId?: string) {
		this.accessKeyId = accessKeyId as string
		this.secretAccessKey = secretAccessKey as string
		this.securityToken = securityToken as string
	}

	public GetAccessKey(): string {
		return this.accessKeyId
	}

	public GetSecretKey(): string {
		return this.secretAccessKey
	}
}
