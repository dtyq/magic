import { logger as Logger } from "@/infrastructure/logger"
import { EventFactory } from "./eventFactory"

export const eventFactory = new EventFactory()

export const logger = Logger.createLogger("eventFactory")
