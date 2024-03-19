import type { GlobalSearch } from "@/opensource/types/search"
import { useDeepCompareEffect, useRequest as useRequestHook } from "ahooks"
import { useImmer } from "use-immer"
import { SearchApi } from "@/opensource/apis"

export const useRequest = <T>(searchWord: string, searchType: number) => {
	const [result, setResult] = useImmer<{
		lastSearch: string
		token: string
		data: Array<T>
		hasMorePage: boolean
	}>({
		lastSearch: "",
		token: "",
		data: [],
		hasMorePage: true,
	})

	const { loading, run, cancel } = useRequestHook(
		(params: GlobalSearch.SearchParams) =>
			SearchApi.getSearch({
				type: params.type ?? -1,
				key_word: params.key_word,
				page_token: params.key_word === "" ? "" : params.page_token,
				page_size: 20,
			}),
		{
			manual: true,
			debounceWait: 200,
			debounceLeading: false,
			debounceTrailing: true,
			onSuccess([response], [query]) {
				setResult((preState) => {
					if (query.key_word !== preState.lastSearch) {
						preState.data = []
					}
					// 相同结果处理
					preState.lastSearch = query.key_word ?? ""
					preState.token = response.page_token ?? ""
					preState.data = Array.from(new Set(preState.data.concat(response.data ?? [])))
					preState.hasMorePage = response.data.length === 20
				})
			},
		},
	)

	useDeepCompareEffect(() => {
		setResult((preState) => {
			preState.data = []
			preState.token = ""
			preState.hasMorePage = true
		})
		if (searchWord !== "") {
			run({
				type: searchType,
				key_word: searchWord,
				page_token: "",
			})
		}
	}, [searchWord])

	return {
		loading,
		run: (params: GlobalSearch.SearchParams) => {
			cancel?.()
			return run(params)
		},
		data: result.data,
		hasMorePage: result.hasMorePage,
		nextRequestToken: result.token,
	}
}
