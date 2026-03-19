import type {
	FunctionDefinition,
	FunctionExecutor,
	FunctionMeta,
	FunctionHubOptions,
} from "./types"
import { FunctionNotFoundError, FunctionAlreadyExistsError, FunctionExecutionError } from "./errors"
import { ScopedFunctionHub } from "./ScopedFunctionHub"

/**
 * FunctionHub - A service for managing and executing functions with injection and override capabilities
 */
export class FunctionHub {
	private functions = new Map<string, FunctionExecutor<readonly unknown[], unknown>>()
	private metadata = new Map<string, FunctionMeta>()
	private options: FunctionHubOptions

	constructor(options: FunctionHubOptions = {}) {
		this.options = {
			enableMetrics: true,
			...options,
		}
	}

	/**
	 * Register a new function in the hub
	 */
	register<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		definition: FunctionDefinition<TArgs, TReturn>,
	): this {
		const { name, fn, description, override = false } = definition

		if (this.functions.has(name) && !override) {
			throw new FunctionAlreadyExistsError(name)
		}

		this.functions.set(name, fn as FunctionExecutor<readonly unknown[], unknown>)

		if (this.options.enableMetrics) {
			this.metadata.set(name, {
				name,
				description,
				registeredAt: new Date(),
				executionCount: 0,
			})
		}

		return this
	}

	/**
	 * Inject a function (alias for register with override: true)
	 */
	inject<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		name: string,
		fn: FunctionExecutor<TArgs, TReturn>,
		description?: string,
	): this {
		return this.register({ name, fn, description, override: true })
	}

	/**
	 * Override an existing function
	 */
	override<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		name: string,
		fn: FunctionExecutor<TArgs, TReturn>,
		description?: string,
	): this {
		if (!this.functions.has(name)) {
			throw new FunctionNotFoundError(name)
		}

		return this.register({ name, fn, description, override: true })
	}

	/**
	 * Execute a function by name
	 */
	execute<TReturn = unknown, TArgs extends readonly unknown[] = readonly unknown[]>(
		name: string,
		...args: TArgs
	): TReturn {
		const fn = this.functions.get(name)
		if (!fn) {
			throw new FunctionNotFoundError(name)
		}

		const metadata = this.metadata.get(name)
		if (metadata && this.options.enableMetrics) {
			metadata.executionCount++
			metadata.lastExecuted = new Date()
		}

		try {
			const result = fn(...args)
			return result as TReturn
		} catch (error) {
			throw new FunctionExecutionError(name, error as Error)
		}
	}

	/**
	 * Remove a function from the hub
	 */
	remove(name: string): boolean {
		const deleted = this.functions.delete(name)
		if (deleted && this.options.enableMetrics) {
			this.metadata.delete(name)
		}
		return deleted
	}

	/**
	 * Check if a function exists
	 */
	has(name: string): boolean {
		return this.functions.has(name)
	}

	/**
	 * Get all registered function names
	 */
	getNames(): string[] {
		return Array.from(this.functions.keys())
	}

	/**
	 * Get function metadata
	 */
	getMeta(name: string): FunctionMeta | undefined {
		return this.metadata.get(name)
	}

	/**
	 * Get all functions metadata
	 */
	getAllMeta(): FunctionMeta[] {
		return Array.from(this.metadata.values())
	}

	/**
	 * Clear all functions
	 */
	clear(): this {
		this.functions.clear()
		this.metadata.clear()
		return this
	}

	/**
	 * Get the count of registered functions
	 */
	size(): number {
		return this.functions.size
	}

	/**
	 * Create a batch registration helper
	 */
	batch(definitions: FunctionDefinition[]): this {
		definitions.forEach((definition) => this.register(definition))
		return this
	}

	/**
	 * Create a scoped function hub
	 */
	scope(prefix: string): ScopedFunctionHub {
		return new ScopedFunctionHub(this, prefix)
	}
}
