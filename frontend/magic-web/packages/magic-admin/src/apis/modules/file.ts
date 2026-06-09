import type { HttpClient } from "../core/HttpClient"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"

export interface ReportFileUploadsData {
	file_extension?: string
	file_key: string
	file_size: number
	file_name: string
}

export interface ReportFileUploadsResponse {
	file_id: string
	user_id: string
	magic_message_id: string
	organization_code: string
	file_extension: string
	file_key: string
	file_name: string
	file_size: number
	created_at: string
	updated_at: string
}

export const generateFileApi = (fetch: HttpClient) => ({
	/**
	 * 检查文件上传状态
	 */
	checkFileUploadStatus(params: any) {
		return fetch.post(genRequestUrl(RequestUrl.checkFileUploadStatus), params)
	},

	/**
	 * 上报文件上传
	 */
	reportFileUploads(data: ReportFileUploadsData[]) {
		return fetch.post<ReportFileUploadsResponse[]>(
			genRequestUrl(RequestUrl.reportFileUpload),
			data,
		)
	},

	/**
	 * 文件链接下载
	 */
	getFileUrl(file_key: string) {
		return fetch.post<{
			path: string
			url: string
			expires: number
			download_name: string
		}>(genRequestUrl(RequestUrl.getFileDownloadLink), { file_key })
	},

	/**
	 * 获取上传token
	 * @returns
	 */
	fetchUploadToken() {
		return fetch.get<{
			temporary_credential: {
				dir: string
			}
		}>(RequestUrl.getUploadToken, {
			method: "get",
			headers: {
				"Content-Type": "application/json",
				"request-id": Date.now().toString(),
			},
		})
	},
})
