// Re-export core types
export type {
	FunctionDefinition,
	FunctionMeta,
	ExecutionContext,
	FunctionHubOptions,
	MiddlewareFunction,
	FunctionExecutor,
} from "./core/types"

export {
	FunctionNotFoundError,
	FunctionAlreadyExistsError,
	FunctionExecutionError,
} from "./core/errors"

// Additional utility types
export interface FunctionRegistry {
	[key: string]: (...args: any[]) => any | Promise<any>
}

export interface BatchDefinition<T = any, R = any> {
	functions: Array<{
		name: string
		fn: (...args: T[]) => R | Promise<R>
		description?: string
		override?: boolean
	}>
	middleware?: Array<(context: any, next: () => Promise<R>) => Promise<R>>
	options?: Partial<{
		enableMetrics?: boolean
		enableMiddleware?: boolean
		maxExecutionTime?: number
	}>
}

export interface FunctionStats {
	totalFunctions: number
	totalExecutions: number
	averageExecutionTime?: number
	mostExecutedFunction?: string
	lastExecutionTime?: Date
}

export interface LoggingMiddlewareOptions {
	enableConsoleLog?: boolean
	enableMetrics?: boolean
	logLevel?: "debug" | "info" | "warn" | "error"
}

export interface ValidationMiddlewareOptions<T = any> {
	validateArgs?: (args: T[]) => boolean | Promise<boolean>
	validateResult?: (result: any) => boolean | Promise<boolean>
	throwOnValidationError?: boolean
}

export interface RetryMiddlewareOptions {
	maxRetries?: number
	retryDelay?: number
	retryCondition?: (error: Error) => boolean
}

// Event types
export interface FunctionEvent<T = any> {
	type: "register" | "execute" | "error" | "remove"
	functionName: string
	timestamp: Date
	data?: T
}

export type EventListener<T = any> = (event: FunctionEvent<T>) => void

export interface EventEmitterMethods {
	on(event: string, listener: EventListener): void
	off(event: string, listener: EventListener): void
	emit(event: string, data?: any): void
}
