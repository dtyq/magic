import { logger as Logger } from "@/utils/log"

export function isDocumentVisible() {
	return document.visibilityState === "visible"
}

export const logger = Logger.createLogger("sso")
