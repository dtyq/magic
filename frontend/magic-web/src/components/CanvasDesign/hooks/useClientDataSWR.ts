import type { SWRConfiguration, SWRHook } from "swr"
import useSWR from "swr"

export const useClientDataSWR = ((
	key: Parameters<SWRHook>[0],
	fetch: Parameters<SWRHook>[1],
	config: SWRConfiguration,
) =>
	useSWR(key, fetch, {
		refreshWhenOffline: false,
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		refreshWhenHidden: false,
		refreshWhenNotVisible: false,
		...config,
	})) as SWRHook
