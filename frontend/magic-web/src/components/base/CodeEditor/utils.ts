export function getMonacoLanguageByFileName(fileName = "file.html") {
	const ext = fileName.split(".").pop()?.toLowerCase()

	switch (ext) {
		case "html":
		case "htm":
			return "html"
		case "css":
			return "css"
		case "js":
			return "javascript"
		case "ts":
			return "typescript"
		case "jsx":
			return "javascript"
		case "tsx":
			return "typescript"
		case "json":
			return "json"
		case "xml":
			return "xml"
		case "md":
			return "markdown"
		case "py":
			return "python"
		case "java":
			return "java"
		case "php":
			return "php"
		case "sql":
			return "sql"
		case "go":
			return "go"
		case "cpp":
		case "c":
			return "cpp"
		case "cs":
			return "csharp"
		case "rb":
			return "ruby"
		case "swift":
			return "swift"
		case "kt":
			return "kotlin"
		case "rs":
			return "rust"
		case "scala":
			return "scala"
		case "sh":
		case "bash":
			return "shell"
		case "yaml":
		case "yml":
			return "yaml"
		case "toml":
			return "toml"
		case "ini":
			return "ini"
		default:
			return "html"
	}
}
