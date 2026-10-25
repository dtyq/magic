import { logger as Logger } from "@/infrastructure/logger"

export interface AppServiceContext {
	logger: ReturnType<typeof Logger.createLogger>
}
