import axios from "axios"
import type { AxiosInstance } from "axios"

export const jsonSchemaDesignerRequestOptions = {
	timeout: 30000,
	timeoutErrorMessage: "网络请求超时",
	withCredentials: false,
	headers: {
		"content-type": "application/json"
	}
}


export const getDefaultService = (baseURL: string) => {
	return axios.create({
		...jsonSchemaDesignerRequestOptions,
		baseURL
	})
}

export type RequestInstance = AxiosInstance