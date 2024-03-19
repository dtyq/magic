import { logger as Logger } from "@/opensource/utils/log"

export interface AppServiceContext {
	logger: ReturnType<typeof Logger.createLogger>
}
