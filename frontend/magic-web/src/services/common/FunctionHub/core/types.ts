/**
 * Core type definitions for FunctionHub
 */

export interface FunctionDefinition<
	TArgs extends readonly unknown[] = readonly unknown[],
	TReturn = unknown,
> {
	name: string
	fn: FunctionExecutor<TArgs, TReturn>
	description?: string
	override?: boolean
}

export interface FunctionMeta {
	name: string
	description?: string
	registeredAt: Date
	executionCount: number
	lastExecuted?: Date
}

export interface FunctionHubOptions {
	enableMetrics?: boolean
}

export type FunctionExecutor<
	TArgs extends readonly unknown[] = readonly unknown[],
	TReturn = unknown,
> = (...args: TArgs) => TReturn
