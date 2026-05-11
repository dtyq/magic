import type { MagicClawItem } from "@/apis"

export const MAGI_CLAW_LIST_POLLING_INTERVAL = 60_000

/** Stable fallback so list deps (e.g. useEffect [claws]) do not churn each render */
export const EMPTY_MAGIC_CLAW_LIST: MagicClawItem[] = []

/** Set when product provides a user-guide URL; empty hides the header link */
export const MAGI_CLAW_USER_GUIDE_URL = ""
