import { useEffect } from "react"
import { useDebounceFn } from "ahooks"
import { reaction } from "mobx"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { PPTStore } from "../stores"

interface UseSlideFileLocatorOptions {
	store: PPTStore
	debounceWait?: number
}

/**
 * Hook to automatically locate file in tree when active slide changes
 * Uses debounced reaction to avoid excessive tree updates during navigation
 */
export function useSlideFileLocator({ store, debounceWait = 800 }: UseSlideFileLocatorOptions) {
	const { run: debouncedLocateFile } = useDebounceFn(
		(index: number) => {
			const currentFileId = store.getFileIdByPath(store.slidePaths[index])
			if (currentFileId) {
				pubsub.publish(PubSubEvents.Locate_File_In_Tree, currentFileId)
			}
		},
		{ wait: debounceWait },
	)

	useEffect(() => {
		return reaction(
			() => store.activeIndex,
			(index) => {
				debouncedLocateFile(index)
			},
		)
	}, [debouncedLocateFile, store])
}
