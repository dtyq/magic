import { parse, type Node } from "acorn"

type SyntaxNode = Node & Record<string, unknown>

const GLOBAL_OBJECT_NAMES = ["globalThis", "window", "self"]

function isNode(value: unknown): value is SyntaxNode {
	return typeof value === "object" && value !== null && "type" in value
}

function isProperty(node: SyntaxNode, name: string): boolean {
	if (node.type !== "MemberExpression" || !isNode(node.property)) return false
	return node.computed
		? node.property.type === "Literal" && node.property.value === name
		: node.property.type === "Identifier" && node.property.name === name
}

function isLocation(node: SyntaxNode): boolean {
	if (node.type === "Identifier") return node.name === "location"
	return (
		isProperty(node, "location") &&
		isNode(node.object) &&
		node.object.type === "Identifier" &&
		["window", "self", "globalThis", "document"].includes(String(node.object.name))
	)
}

function collectBindings(pattern: unknown, bindings: Set<string>): void {
	if (!isNode(pattern)) return
	switch (pattern.type) {
		case "Identifier":
			bindings.add(String(pattern.name))
			break
		case "ObjectPattern":
			if (Array.isArray(pattern.properties)) {
				for (const property of pattern.properties) {
					if (isNode(property))
						collectBindings(property.value ?? property.argument, bindings)
				}
			}
			break
		case "ArrayPattern":
			if (Array.isArray(pattern.elements)) {
				for (const element of pattern.elements) collectBindings(element, bindings)
			}
			break
		case "AssignmentPattern":
			collectBindings(pattern.left, bindings)
			break
		case "RestElement":
			collectBindings(pattern.argument, bindings)
			break
	}
}

/** Rewrite href writes and Location method receivers, never strings/comments or reads. */
export function rewriteLocationHref(source: string, sourceType: "script" | "module" = "script") {
	if (!source.includes("location")) return source
	let ast: Node
	try {
		ast = parse(source, { ecmaVersion: "latest", sourceType, allowReturnOutsideFunction: true })
	} catch {
		// Unsupported syntax must keep its original behavior rather than break the whole page.
		return source
	}

	const targets: { node: SyntaxNode; adapter: "getLocation" | "getWindow"; bare?: boolean }[] = []
	const bindings = new Set<string>()
	const pending: unknown[] = [ast]
	while (pending.length) {
		const node = pending.pop()
		if (!isNode(node)) continue
		// Pick a global name that is unbound throughout the script, including hoisted
		// declarations, parameters, imports and destructuring. This avoids injecting
		// a reference that can resolve to a user-owned local object or a TDZ binding.
		collectBindings(node.id, bindings)
		collectBindings(node.param, bindings)
		collectBindings(node.local, bindings)
		if (Array.isArray(node.params)) {
			for (const param of node.params) collectBindings(param, bindings)
		}
		// `with` introduces dynamic bindings which cannot be resolved statically.
		if (node.type === "WithStatement") return source
		if (
			node.type === "AssignmentExpression" &&
			isNode(node.left) &&
			isProperty(node.left, "href") &&
			isNode(node.left.object) &&
			isLocation(node.left.object)
		) {
			targets.push({ node: node.left.object, adapter: "getLocation" })
		}
		if (node.type === "AssignmentExpression" && isNode(node.left) && isLocation(node.left)) {
			if (node.left.type === "Identifier") {
				targets.push({ node: node.left, adapter: "getLocation", bare: true })
			} else if (isNode(node.left.object)) {
				targets.push({ node: node.left.object, adapter: "getWindow" })
			}
		}
		// Location.assign/replace are unforgeable in browsers too. Rewriting their
		// receiver works where assigning an instance method silently fails.
		if (
			node.type === "CallExpression" &&
			isNode(node.callee) &&
			(isProperty(node.callee, "assign") || isProperty(node.callee, "replace")) &&
			isNode(node.callee.object) &&
			isLocation(node.callee.object)
		) {
			targets.push({ node: node.callee.object, adapter: "getLocation" })
		}
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const child of value) pending.push(child)
			} else if (isNode(value)) pending.push(value)
		}
	}
	const globalObject = GLOBAL_OBJECT_NAMES.find((name) => !bindings.has(name))
	if (!globalObject) return source

	// Replace from right to left so source offsets, formatting and expression values survive.
	return (
		targets
			// A bare lexical variable needs its original assignment target. Conservatively
			// skip bare writes when any local binding exists rather than guessing its scope.
			.filter((target) => !target.bare || !bindings.has("location"))
			.sort((a, b) => b.node.start - a.node.start)
			.reduce((result, target) => {
				const original = source.slice(target.node.start, target.node.end)
				const replacement = `/*__MAGIC_LOCATION_START__:${encodeURIComponent(original)}__*/${globalObject}.__MAGIC_HTML_NAVIGATION_RUNTIME__.${target.adapter}(${original})${target.bare ? ".href" : ""}/*__MAGIC_LOCATION_END__*/`
				return (
					result.slice(0, target.node.start) + replacement + result.slice(target.node.end)
				)
			}, source)
	)
}

export function rewriteHtmlLocationHref(doc: Document): void {
	doc.querySelectorAll("script:not([src]):not([data-injected])").forEach((script) => {
		const type = script.getAttribute("type")?.trim().toLowerCase() || ""
		if (type && !/^(module|(?:text|application)\/(?:java|ecma)script)$/.test(type)) return
		script.textContent = rewriteLocationHref(
			script.textContent || "",
			type === "module" ? "module" : "script",
		)
	})
	// Inline event handlers are functions too; allow their top-level return statements.
	doc.querySelectorAll("*").forEach((element) => {
		for (const attribute of Array.from(element.attributes)) {
			if (!attribute.name.startsWith("on")) continue
			element.setAttribute(attribute.name, rewriteLocationHref(attribute.value))
		}
	})
}
