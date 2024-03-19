// export { GlobalErrorLogger } from "./logger/GlobalErrorLogger"
// export { FetchLogger } from "./logger/FetchLogger"
// export { OperationsLogger } from "./logger/OperationsLogger"

import Logger from "./Logger"
import {
	createSensitiveDataPlugin,
	createDeduplicationPlugin,
	createErrorParserPlugin,
	createConsolePlugin,
	createReporterPlugin,
	createFetchMonitorPlugin,
	createResourceMonitorPlugin,
	createErrorMonitorPlugin,
	createPageDwellTimePlugin,
	createDeviceMonitorPlugin,
} from "./plugins"
import { isDev } from "@/opensource/utils/env"

export const logger = new Logger({
	enableConfig: true,
	plugins: [
		createDeviceMonitorPlugin(),
		createPageDwellTimePlugin(),
		createResourceMonitorPlugin(),
		createErrorMonitorPlugin(),
		createFetchMonitorPlugin(),
		createErrorParserPlugin(),
		createSensitiveDataPlugin(),
		createDeduplicationPlugin(),
		createConsolePlugin({
			enabled: !isDev,
		}),
		createReporterPlugin(),
	],
})
