// 模拟OBS客户端
class ObsClientMock {
	accessKeyId: string

	secretAccessKey: string

	securityToken?: string

	server: string

	constructor(options: any) {
		this.accessKeyId = options.access_key_id
		this.secretAccessKey = options.secret_access_key
		this.securityToken = options.security_token
		this.server = options.server
	}

	// 模拟初始化分片上传的方法
	initiateMultipartUpload(params: any, callback: any) {
		const response = {
			InterfaceResult: {
				RequestId: "test-request-id",
				UploadId: "test-upload-id",
			},
			CommonMsg: {
				Status: 200,
				Message: "OK",
			},
		}

		setTimeout(() => {
			callback(null, response)
		}, 10)
	}

	// 模拟上传分片的方法
	uploadPart(params: any, callback: any) {
		const response = {
			InterfaceResult: {
				ETag: '"test-etag"',
			},
			CommonMsg: {
				Status: 200,
				Message: "OK",
			},
		}

		setTimeout(() => {
			callback(null, response)
		}, 10)
	}

	// 模拟完成分片上传的方法
	completeMultipartUpload(params: any, callback: any) {
		const response = {
			InterfaceResult: {
				Bucket: params.Bucket,
				Key: params.Key,
				ETag: '"test-etag-final"',
				Location: `http://${params.Bucket}.${this.server}/${params.Key}`,
			},
			CommonMsg: {
				Status: 200,
				Message: "OK",
			},
		}

		setTimeout(() => {
			callback(null, response)
		}, 10)
	}

	// 模拟取消分片上传的方法
	abortMultipartUpload(params: any, callback: any) {
		const response = {
			CommonMsg: {
				Status: 204,
				Message: "No Content",
			},
		}

		setTimeout(() => {
			callback(null, response)
		}, 10)
	}

	// 模拟普通上传的方法
	putObject(params: any, callback: any) {
		const response = {
			InterfaceResult: {
				ETag: '"test-etag"',
			},
			CommonMsg: {
				Status: 200,
				Message: "OK",
			},
		}

		setTimeout(() => {
			callback(null, response)
		}, 10)
	}
}

export default ObsClientMock
