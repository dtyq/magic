import { logger as Logger } from "@/infrastructure/logger"

export function isDocumentVisible() {
	return document.visibilityState === "visible"
}

export const logger = Logger.createLogger("sso")
