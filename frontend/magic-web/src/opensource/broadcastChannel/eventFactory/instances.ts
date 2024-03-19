import { logger as Logger } from "@/opensource/utils/log"
import { EventFactory } from "./eventFactory"

export const eventFactory = new EventFactory()

export const logger = Logger.createLogger("eventFactory")
