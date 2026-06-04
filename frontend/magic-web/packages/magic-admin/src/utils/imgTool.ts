import { message } from "antd"
import i18next from "i18next"
// 创建一个Image对象来获取图片的宽高,url
export const getImageInfo = (
	file: File,
	minSize?: number,
): Promise<{ isValidSize: boolean; url: string }> => {
	return new Promise((resolve) => {
		const img = new Image()
		img.src = URL.createObjectURL(file)
		img.onload = () => {
			let isValidSize = true
			if (minSize) {
				isValidSize = img.width >= minSize && img.height >= minSize
				if (!isValidSize) {
					message.error(i18next.t("form.uploadSizeError", { ns: "ai/model" }))
				}
			}
			resolve({
				isValidSize,
				url: URL.createObjectURL(file),
			})
		}
	})
}
