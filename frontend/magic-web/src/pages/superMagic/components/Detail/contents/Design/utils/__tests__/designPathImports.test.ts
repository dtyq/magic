import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const testFileDir = path.dirname(fileURLToPath(import.meta.url))
const designRootDir = path.resolve(testFileDir, "..", "..")
const messageEditorRootDir = path.resolve(designRootDir, "..", "..", "..", "MessageEditor")
const canvasDesignRootDir = path.resolve(process.cwd(), "src", "components", "CanvasDesign")
const designPathFacadeFile = path.join(designRootDir, "utils", "designPath.ts")
const resourceReferenceResolverFile = path.join(
	designRootDir,
	"utils",
	"designResourceReferenceResolver.ts",
)
const designFileDropPathsFile = path.join(designRootDir, "hooks", "useDesignFileDropPaths.ts")

function walkFiles(dir: string): string[] {
	const results: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			results.push(...walkFiles(fullPath))
			continue
		}
		results.push(fullPath)
	}
	return results
}

function readText(filePath: string): string {
	return fs.readFileSync(filePath, "utf8")
}

describe("design path import scan", () => {
	it("keeps production code on the designPath facade", () => {
		const files = [...walkFiles(designRootDir), ...walkFiles(messageEditorRootDir)].filter(
			(filePath) => {
				if (!/\.(ts|tsx)$/.test(filePath)) return false
				if (filePath.includes("__tests__")) return false
				return filePath !== designPathFacadeFile
			},
		)

		const offenders = files.filter((filePath) =>
			readText(filePath).match(
				/from\s+["'][^"']*(designDslPathUtils|designAttachmentPathLookup|designPathPrimitives|designAttachmentLookup|components\/CanvasDesign\/runtime\/shared\/path\/(?:pathUtils|internal)|runtime\/shared\/path\/internal)["']/,
			),
		)

		expect(offenders).toEqual([])
	})

	it("does not add new production findFileBySrc call sites", () => {
		const files = [...walkFiles(designRootDir), ...walkFiles(messageEditorRootDir)].filter(
			(filePath) => {
				if (!/\.(ts|tsx)$/.test(filePath)) return false
				if (filePath.includes("__tests__")) return false
				return true
			},
		)

		const offenders = files.filter((filePath) => /findFileBySrc\s*\(/.test(readText(filePath)))
		expect(offenders).toEqual([])
	})

	it("keeps resource path and attachment resolution behind the unified resolver", () => {
		const files = [...walkFiles(designRootDir), ...walkFiles(messageEditorRootDir)].filter(
			(filePath) => {
				if (!/\.(ts|tsx)$/.test(filePath)) return false
				if (filePath.includes("__tests__")) return false
				return (
					filePath !== designPathFacadeFile && filePath !== resourceReferenceResolverFile
				)
			},
		)
		const forbiddenLegacyReferences =
			/\b(?:resolveDesignPathForOperation|resolveDesignAttachment|toWorkspaceRelativeCandidates|toWorkspaceRelativePath|getResolvedPathCandidates|toWorkspaceAbsoluteApiPath|toDesignApiPath|isRelativeDesignPath|toWorkspaceAbsoluteApiPathForOperation|resolveDesignAttachmentForNormalizedPath|resolveDesignAttachmentFromCandidates|getDesignPathFileName|isCurrentCanvasResourcePath)\b/

		const offenders = files.filter((filePath) =>
			forbiddenLegacyReferences.test(readText(filePath)),
		)
		expect(offenders).toEqual([])
	})

	it("does not reintroduce the split legacy CanvasDesign path APIs", () => {
		const files = [
			...walkFiles(canvasDesignRootDir),
			...walkFiles(designRootDir),
			...walkFiles(messageEditorRootDir),
		].filter((filePath) => {
			if (!/\.(ts|tsx)$/.test(filePath)) return false
			if (filePath.includes("__tests__")) return false
			return true
		})
		const forbiddenLegacyApis =
			/\b(?:resolveAbsolutePath|resolveResourcePathCandidates|normalizeResourcePathForStorage|getCanvasResourceIdentity|areCanvasResourcePathsSame|toWeakCanvasResourcePath)\b/

		const offenders = files.filter((filePath) => forbiddenLegacyApis.test(readText(filePath)))
		expect(offenders).toEqual([])
	})

	it("uses backend copy naming for external project-file drops", () => {
		const source = readText(designFileDropPathsFile)

		expect(source).not.toMatch(/\.copyFiles\s*\(|checkBatchOperationStatus|createFile\s*\(/)
		expect(source).toMatch(/SuperMagicApi\.copyFile\s*\(/)
		expect(source).toMatch(/keep_both_file_ids/)
		expect(fs.existsSync(path.join(designRootDir, "hooks", "useDesignFileCopy.ts"))).toBe(false)
	})
})
