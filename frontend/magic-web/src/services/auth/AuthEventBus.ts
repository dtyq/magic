import { EventBus } from "@/services/common/EventBus"
import type { AuthEvents } from "./AuthEvents"

/** Shared in-process authentication event bus for the current application instance. */
export const authEventBus = new EventBus<AuthEvents>()
