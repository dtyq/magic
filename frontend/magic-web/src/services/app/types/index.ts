import { logger as Logger } from "@/utils/log"

export interface AppServiceContext {
	logger: ReturnType<typeof Logger.createLogger>
}
