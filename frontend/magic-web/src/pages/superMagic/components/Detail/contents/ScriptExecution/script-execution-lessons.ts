import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { DetailScriptExecutionData } from "../../types"

export type ScriptLessonScenario =
	| "basic"
	| "corrected"
	| "channels"
	| "failure"
	| "success"
	| "warning"
	| "error"
	| "reading"
	| "empty"
const quote = (value: string) => JSON.stringify(value)

/** 教学只提供展示输入，不调用执行工具；各段代码与对应输出一起构造。 */
export function useScriptLessonData(scenario: ScriptLessonScenario): DetailScriptExecutionData {
	const { t } = useTranslation("super")
	return useMemo(() => {
		if (scenario === "basic" || scenario === "corrected" || scenario === "failure") {
			const code = [
				"items = [10, 20, 30]",
				"total = sum(items)",
				scenario === "failure"
					? "print(totla)"
					: scenario === "corrected"
						? "print(total)"
						: `print(f${quote(t("scriptExecution.help.lesson.sample.basicTemplate"))})`,
			].join("\n")
			return {
				code,
				stdout:
					scenario === "corrected"
						? "60"
						: scenario === "basic"
							? t("scriptExecution.help.lesson.sample.basicOutput")
							: "",
				stderr:
					scenario === "failure"
						? "Traceback (most recent call last):\n  File \"example.py\", line 3, in <module>\n    print(totla)\nNameError: name 'totla' is not defined"
						: "",
				success: scenario !== "failure",
				exit_code: scenario !== "failure" ? 0 : 1,
			}
		}
		if (scenario === "channels") {
			const stdout = t("scriptExecution.help.lesson.sample.simpleOutput"),
				stderr = t("scriptExecution.help.lesson.sample.simpleWarning")
			return {
				code: [
					"import sys",
					`print(${quote(stdout)})`,
					`print(${quote(stderr)}, file=sys.stderr)`,
				].join("\n"),
				stdout,
				stderr,
				success: true,
				exit_code: 0,
			}
		}
		if (scenario === "reading") {
			return {
				code: [
					"for index in range(1, 241):",
					`    print(f${quote(t("scriptExecution.help.lesson.sample.recordTemplate"))})`,
					`print(${quote(t("scriptExecution.help.lesson.sample.recordsComplete"))})`,
				].join("\n"),
				stdout: [
					...Array.from({ length: 240 }, (_, index) =>
						t("scriptExecution.help.lesson.sample.record", { index: index + 1 }),
					),
					t("scriptExecution.help.lesson.sample.recordsComplete"),
				].join("\n"),
				stderr: "",
				success: true,
				exit_code: 0,
			}
		}
		const lines = [
			"import pandas as pd",
			'table = pd.read_excel("sales.xlsx")',
			`total = table[${quote(t("scriptExecution.help.lesson.sample.amountColumn"))}].sum()`,
			`print(f${quote(t("scriptExecution.help.lesson.sample.rowsTemplate"))})`,
			`print(f${quote(t("scriptExecution.help.lesson.sample.totalTemplate"))})`,
			'table.to_excel("monthly_sales.xlsx", index=False)',
			`print(${quote(t("scriptExecution.help.lesson.sample.saved"))})`,
		]
		let stdout = [
				t("scriptExecution.help.lesson.sample.rows"),
				t("scriptExecution.help.lesson.sample.total"),
				t("scriptExecution.help.lesson.sample.saved"),
			].join("\n"),
			stderr = ""
		if (scenario === "warning") {
			lines.splice(1, 0, "import sys")
			lines.push(
				`missing = table[${quote(t("scriptExecution.help.lesson.sample.customerColumn"))}].isna().sum()`,
				"if missing:",
				`    print(f${quote(t("scriptExecution.help.lesson.sample.warningTemplate"))}, file=sys.stderr)`,
			)
			stderr = t("scriptExecution.help.lesson.sample.warning")
		}
		if (scenario === "empty") {
			stdout = ""
			lines.splice(3, 2)
			lines.pop()
		}
		if (scenario === "error") {
			stdout = ""
			stderr = [
				"Traceback (most recent call last):",
				'  File "monthly_sales.py", line 2, in <module>',
				'    table = pd.read_excel("sales.xlsx")',
				'  File "zipfile/__init__.py", in _RealGetContents',
				'    raise BadZipFile("File is not a zip file")',
				"zipfile.BadZipFile: File is not a zip file",
			].join("\n")
		}
		return {
			code: lines.join("\n"),
			stdout,
			stderr,
			success: scenario !== "error",
			exit_code: scenario === "error" ? 1 : 0,
		}
	}, [scenario, t])
}
