import { Upload } from "@dtyq/upload-sdk"
import dayjs from "@/lib/dayjs"
import { env } from "@/utils/env"
import { genRequestUrl } from "@/utils/http"
import { userStore } from "@/models/user"
import { RequestMethod } from "@/apis/constant"
import { FileApi } from "@/apis"

const LONG_TEXT_FILE_PREFIX = "long_text_"
const LONG_TEXT_FILE_EXTENSION = "txt"
const LONG_TEXT_FILE_TYPE = "text/plain;charset=utf-8"

class MessageFileService {
	private uploader = new Upload()
	private storageType = "private"

	async uploadFileByText(text: string) {
		// 生成文件，并上传
		const blob = new Blob([text], {
			type: LONG_TEXT_FILE_TYPE,
		})

		const fileName = `${LONG_TEXT_FILE_PREFIX}${dayjs().unix()}.${LONG_TEXT_FILE_EXTENSION}`

		const file = new File([blob], fileName, {
			type: LONG_TEXT_FILE_TYPE,
			lastModified: dayjs().unix(),
		})

		const { organizationCode } = userStore.user

		const url = `${env("MAGIC_SERVICE_BASE_URL") + genRequestUrl("/api/v1/file/temporary-credential")
			}?organization_code=${organizationCode}`

		const { success, fail } = await this.uploader.upload({
			url,
			file,
			fileName,
			method: RequestMethod.POST,
			headers: {
				"Content-Type": "application/json",
				authorization: userStore.user.authorization ?? "",
				"Organization-Code": organizationCode ?? "",
			},
			option: {
				rewriteFileName: true,
			},
			body: JSON.stringify({
				storage: this.storageType,
			}),
		})

		return new Promise((resolve, reject) => {
			success?.((res) => {
				if (res) {
					// 上报文件
					return FileApi.reportFileUploads([
						{
							file_extension: LONG_TEXT_FILE_EXTENSION,
							file_key: res.data.path,
							file_size: file.size,
							file_name: fileName,
						},
					])
						.then((res) => {
							resolve(res)
						})
						.catch((err) => {
							reject(err)
						})
				}
			})

			fail?.((err) => {
				reject(err)
			})
		})
	}
}

export default new MessageFileService()
