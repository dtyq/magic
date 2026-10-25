import {
	SCENARIO_NAMES,
	type BenchmarkProfile,
	type BenchmarkTarget,
	type ScenarioName,
} from "./types"

export interface ParsedArgs {
	values: Map<string, string>
	flags: Set<string>
}

export function parseArgs(argv: string[]): ParsedArgs {
	const values = new Map<string, string>()
	const flags = new Set<string>()

	for (let index = 0; index < argv.length; index++) {
		const token = argv[index]
		if (token === "--") continue
		if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`)
		const equalsIndex = token.indexOf("=")
		if (equalsIndex >= 0) {
			const name = token.slice(2, equalsIndex)
			assertArgumentNotSeen(name, values, flags)
			values.set(name, token.slice(equalsIndex + 1))
			continue
		}

		const name = token.slice(2)
		assertArgumentNotSeen(name, values, flags)
		const next = argv[index + 1]
		if (next && !next.startsWith("--")) {
			values.set(name, next)
			index += 1
		} else {
			flags.add(name)
		}
	}

	return { values, flags }
}

export function assertKnownArgs(
	args: ParsedArgs,
	options: {
		values: readonly string[]
		flags?: readonly string[]
	},
): void {
	const allowedValues = new Set(options.values)
	const allowedFlags = new Set(options.flags ?? [])
	const unknownValues = Array.from(args.values.keys()).filter((name) => !allowedValues.has(name))
	const unknownFlags = Array.from(args.flags).filter((name) => !allowedFlags.has(name))
	const unknown = [...unknownValues, ...unknownFlags]
	if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.map((name) => `--${name}`).join(", ")}`)
}

function assertArgumentNotSeen(
	name: string,
	values: Map<string, string>,
	flags: Set<string>,
): void {
	if (!name) throw new Error("Argument name cannot be empty")
	if (values.has(name) || flags.has(name)) throw new Error(`Duplicate argument: --${name}`)
}

export function readProfile(args: ParsedArgs): BenchmarkProfile {
	const profile = args.values.get("profile") ?? "quick"
	if (profile !== "quick" && profile !== "baseline") {
		throw new Error(`Invalid --profile: ${profile}`)
	}
	return profile
}

export function readTarget(args: ParsedArgs): BenchmarkTarget {
	const target = args.values.get("target") ?? "source"
	if (target !== "dist" && target !== "source") {
		throw new Error(`Invalid --target: ${target}`)
	}
	return target
}

export function readScenarios(args: ParsedArgs): ScenarioName[] {
	const raw = args.values.get("scenario") ?? "all"
	if (raw === "all") return [...SCENARIO_NAMES]
	const requested = raw
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
	const invalid = requested.filter(
		(value): value is string => !SCENARIO_NAMES.includes(value as ScenarioName),
	)
	if (invalid.length > 0) throw new Error(`Invalid --scenario: ${invalid.join(", ")}`)
	return Array.from(new Set(requested)) as ScenarioName[]
}

export function readPositiveInteger(
	args: ParsedArgs,
	name: string,
	fallback: number,
	options: { allowZero?: boolean } = {},
): number {
	const raw = args.values.get(name)
	if (raw === undefined) return fallback
	const value = Number(raw)
	const minimum = options.allowZero ? 0 : 1
	if (!Number.isInteger(value) || value < minimum) {
		throw new Error(`--${name} must be an integer >= ${minimum}`)
	}
	return value
}

export function readPositiveNumber(args: ParsedArgs, name: string, fallback: number): number {
	const raw = args.values.get(name)
	if (raw === undefined) return fallback
	const value = Number(raw)
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`--${name} must be a number > 0`)
	}
	return value
}
