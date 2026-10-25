import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"
import { isEnterpriseEdition } from "../edition"

interface MagicAdminSourceOptions {
	projectRoot: string
}

const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".json", ".css", ".less"]

function tryResolveFile(basePath: string): string | null {
	try {
		const stat = fs.statSync(basePath)
		if (stat.isFile()) return basePath
		if (stat.isDirectory()) {
			for (const name of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
				const candidate = path.join(basePath, name)
				if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
			}
		}
	} catch {
		void 0
	}

	for (const ext of RESOLVE_EXTENSIONS) {
		const candidate = basePath + ext
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
	}

	return null
}

export default function vitePluginMagicAdminSource({
	projectRoot,
}: MagicAdminSourceOptions): Plugin {
	const adminRoot = path.resolve(projectRoot, "packages/magic-admin")
	const sourceRoot = path.join(adminRoot, "src")
	const enterpriseRoot = path.join(adminRoot, "enterprise/src")
	const customerRoot = path.join(adminRoot, "customer/src")
	const componentsRoot = path.join(adminRoot, "components")
	const isEnterprise = isEnterpriseEdition()

	function normalizeImporter(importer?: string): string {
		if (!importer) return ""
		const bare = importer.split("?")[0].split("#")[0]
		const filePath = bare.startsWith("file://") ? new URL(bare).pathname : bare
		const fsPath = filePath.startsWith("/@fs/") ? filePath.slice("/@fs".length) : filePath
		const normalized = path.normalize(fsPath)
		return path.isAbsolute(normalized) ? normalized : path.resolve(projectRoot, normalized)
	}

	/**
	 * @admin/... = 逻辑路径，走 customer > enterprise > src
	 * @admin-customer/... = 物理路径，走 customer
	 * @admin-enterprise/... = 物理路径，走 enterprise
	 * @param logicalPath
	 * @param importer
	 * @returns
	 */
	function resolveAdminLogical(logicalPath: string, importer?: string): string | null {
		const sourcePath = tryResolveFile(path.join(sourceRoot, logicalPath))
		const normalizedImporter = normalizeImporter(importer)

		if (isEnterprise) {
			const customerPath = tryResolveFile(path.join(customerRoot, logicalPath))
			const enterprisePath = tryResolveFile(path.join(enterpriseRoot, logicalPath))
			if (customerPath) {
				const normalizedCustomerPath = path.normalize(customerPath)
				if (normalizedImporter === normalizedCustomerPath)
					return enterprisePath ?? sourcePath
				return customerPath
			}
			if (enterprisePath) {
				const normalizedEnterprisePath = path.normalize(enterprisePath)
				if (normalizedImporter === normalizedEnterprisePath) return sourcePath
				return enterprisePath
			}
		}

		return sourcePath
	}

	function resolvePackageEntry(source: string): string | null {
		const isDtyq = source.startsWith("@dtyq/magic-admin")
		if (!isDtyq) return null

		const subpath = source.replace(/^@dtyq\/magic-admin\/?/, "")

		if (subpath === "") return resolveAdminLogical("index")
		if (subpath === "components") return path.join(componentsRoot, "index.ts")
		if (subpath === "provider") return resolveAdminLogical("provider/AdminProvider")
		if (subpath === "utils/tablerIconLoader")
			return resolveAdminLogical("utils/tablerIconLoader")
		if (subpath === "locales") return resolveAdminLogical("locales")
		if (subpath === "ServiceIcon")
			return resolveAdminLogical("pages/PlatformPackage/components/ServiceIcon")
		if (subpath === "capability" && isEnterprise)
			return resolveAdminLogical("pages/CapabilityManage")

		return null
	}

	return {
		name: "vite-plugin-magic-admin-source",
		enforce: "pre",
		resolveId(source, importer) {
			if (source.startsWith("\0")) return null

			const packageEntry = resolvePackageEntry(source)
			if (packageEntry) return packageEntry

			if (source === "@admin-components") return path.join(componentsRoot, "index.ts")
			if (source.startsWith("@admin/"))
				return resolveAdminLogical(source.slice("@admin/".length), importer)
			if (source.startsWith("@admin-customer/"))
				return tryResolveFile(
					path.join(customerRoot, source.slice("@admin-customer/".length)),
				)
			if (source.startsWith("@admin-enterprise/"))
				return tryResolveFile(
					path.join(enterpriseRoot, source.slice("@admin-enterprise/".length)),
				)

			return null
		},
	}
}
