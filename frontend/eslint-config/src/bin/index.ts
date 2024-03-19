#!/usr/bin/env node
import { program } from "commander"
import { exec } from "child_process"
import { createReadStream, createWriteStream } from "fs"
import { resolve } from "path"

const createHuskyDefaultConfig = () => {
	const templates: Record<string, string> = {
		"commit-msg": resolve(__dirname, "../../src/husky/template/commit-msg"),
		"pre-commit": resolve(__dirname, "../../src/husky/template/pre-commit"),
	}
	Object.keys(templates).forEach((key) => {
		const templatePath = templates[key]
		const templateTargetPath = resolve(process.cwd(), "./.husky", key)
		const sourceStream = createReadStream(templatePath)
		const destinationStream = createWriteStream(templateTargetPath)
		sourceStream.pipe(destinationStream)
	})
}

program
	.command("husky")
	.description("初始化 .husky 配置")
	.action(() => {
		createHuskyDefaultConfig()
	})

program
	.command("husky-emoji")
	.description("初始化 .husky emoji 配置")
	.action(() => {
		createHuskyDefaultConfig()
		exec(resolve(__dirname, "../../src/husky/add-commit-emoji.sh"))
	})

program.parse()
