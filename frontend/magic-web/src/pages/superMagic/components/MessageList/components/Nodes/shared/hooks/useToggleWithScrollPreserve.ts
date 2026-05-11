import { useCallback, useState } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

/**
 * A toggle hook that suppresses the message list's auto-scroll-to-bottom
 * before the height change occurs, preventing scroll jumps when
 * panels are expanded/collapsed within the message list.
 */
export function useToggleWithScrollPreserve(initialOpen = false) {
	const [open, setOpen] = useState(initialOpen)
	const toggle = useCallback(() => {
		pubsub.publish(PubSubEvents.Message_Suppress_Auto_Scroll)
		setOpen((o) => !o)
	}, [])
	return [open, toggle, setOpen] as const
}
