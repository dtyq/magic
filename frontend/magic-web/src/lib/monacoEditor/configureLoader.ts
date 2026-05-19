import { loader } from "@monaco-editor/react"
import { env } from "@/utils/env"

loader.config({
	paths: {
		vs: `${env("MAGIC_CDNHOST")}/monaco-editor/0.52.2/min/vs`,
	},
})
