import type { SWRConfiguration, SWRHook } from "swr"
import useSWR from "swr"

// @ts-ignore
export const useClientDataSWR: SWRHook = (key, fetch, config: SWRConfiguration) =>
	useSWR(key, fetch, {
		// // default is 2000ms ,it makes the user's quick switch don't work correctly.
		// // Cause issue like this: https://github.com/lobehub/lobe-chat/issues/532
		// // we need to set it to 0.
		// dedupingInterval: 0,
		refreshWhenOffline: false,
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		refreshWhenHidden: false,
		refreshWhenNotVisible: false,
		...config,
	})
