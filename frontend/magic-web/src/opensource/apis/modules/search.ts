import { genRequestUrl } from "@/utils/http"
import { RequestUrl } from "../constant"
import type { GlobalSearch } from "@/types/search"
import type { WithPage } from "@/types/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { HttpClient } from "../core/HttpClient"

export const generateSearchApi = (fetch: HttpClient) => ({
	/**
	 * 全局搜索
	 * @param params 搜索参数
	 */
	getSearch(params: GlobalSearch.SearchParams): Promise<any> {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(genRequestUrl(RequestUrl.globalSearch), {
			type: params?.type ?? 1,
			key_word: params?.key_word ?? "",
			page_token: params?.page_token ?? 1,
			page_size: params?.page_size ?? 10,
			extra: params?.extra ?? undefined,
		})
	},
})
