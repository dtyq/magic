import type { IBuffer, IBufferCell, IBufferLine, ITheme, Terminal } from "@xterm/xterm"

export interface TerminalTextStyle {
	start: number
	end: number
	css: string
}

export interface TerminalDocument {
	text: string
	styles: TerminalTextStyle[]
}

function getLineWidth(buffer: IBuffer, line: IBufferLine, columns: number): number {
	const cell = buffer.getNullCell()
	for (let column = Math.min(line.length, columns) - 1; column >= 0; column--) {
		line.getCell(column, cell)
		if (cell.getChars() || !cell.isBgDefault()) return column + Math.max(cell.getWidth(), 1)
	}
	return 0
}

function paletteColor(index: number, theme: ITheme): string {
	const colors = [
		theme.black,
		theme.red,
		theme.green,
		theme.yellow,
		theme.blue,
		theme.magenta,
		theme.cyan,
		theme.white,
		theme.brightBlack,
		theme.brightRed,
		theme.brightGreen,
		theme.brightYellow,
		theme.brightBlue,
		theme.brightMagenta,
		theme.brightCyan,
		theme.brightWhite,
	]
	if (index < colors.length) return colors[index] ?? "inherit"
	// ANSI 256 色标准：16–231 为 6×6×6 色立方，232–255 为灰阶。
	if (index >= 232) {
		const gray = 8 + (index - 232) * 10
		return `rgb(${gray},${gray},${gray})`
	}
	const value = index - 16
	const level = (component: number) => (component === 0 ? 0 : 55 + component * 40)
	return `rgb(${level(Math.floor(value / 36))},${level(Math.floor(value / 6) % 6)},${level(value % 6)})`
}

function cellStyle(cell: IBufferCell, theme: ITheme): string {
	if (cell.isAttributeDefault()) return ""
	let foreground = cell.isFgRGB()
		? `#${cell.getFgColor().toString(16).padStart(6, "0")}`
		: cell.isFgPalette()
			? paletteColor(cell.getFgColor(), theme)
			: ""
	let background = cell.isBgRGB()
		? `#${cell.getBgColor().toString(16).padStart(6, "0")}`
		: cell.isBgPalette()
			? paletteColor(cell.getBgColor(), theme)
			: ""
	if (cell.isInverse()) {
		const previousForeground = foreground || theme.foreground || "inherit"
		foreground = background || theme.background || "inherit"
		background = previousForeground
	}
	const decorations = [
		cell.isUnderline() && "underline",
		cell.isStrikethrough() && "line-through",
		cell.isOverline() && "overline",
	].filter(Boolean)
	return [
		foreground && `color:${foreground}!important`,
		background && `background-color:${background}`,
		cell.isBold() && "font-weight:700",
		cell.isItalic() && "font-style:italic",
		cell.isDim() && "opacity:0.65",
		cell.isInvisible() && "color:transparent!important",
		decorations.length && `text-decoration:${decorations.join(" ")}`,
	]
		.filter(Boolean)
		.join(";")
}

/**
 * xterm 负责 ANSI、回车覆盖和光标指令；编辑器只阅读解析后的逻辑行。
 * 合并缓冲中的软换行，显示宽度交给编辑器处理，避免超长行扩大整个终端的列缓存。
 * 原始 command/output 仍由调用方持有，复制整条记录时不使用此展示副本。
 */
export function readTerminalDocument(terminal: Terminal, theme: ITheme): TerminalDocument {
	const buffer = terminal.buffer.active
	const cell = buffer.getNullCell()
	let lastRow = buffer.baseY + buffer.cursorY
	for (let row = buffer.length - 1; row > lastRow; row--) {
		const line = buffer.getLine(row)
		if (line && getLineWidth(buffer, line, terminal.cols)) {
			lastRow = row
			break
		}
	}
	const chunks: string[] = []
	const styles: TerminalTextStyle[] = []
	let offset = 0
	for (let row = 0; row <= lastRow; row++) {
		const line = buffer.getLine(row)
		if (!line) continue
		if (row > 0 && !line.isWrapped) {
			chunks.push("\n")
			offset++
		}
		const width = getLineWidth(buffer, line, terminal.cols)
		for (let column = 0; column < width; column++) {
			line.getCell(column, cell)
			if (!cell.getWidth()) continue
			const characters = cell.getChars() || " "
			const css = cellStyle(cell, theme)
			if (css) {
				const previous = styles[styles.length - 1]
				if (previous?.end === offset && previous.css === css)
					previous.end += characters.length
				else styles.push({ start: offset, end: offset + characters.length, css })
			}
			chunks.push(characters)
			offset += characters.length
		}
	}
	return { text: chunks.join(""), styles }
}

export function formatTerminalTranscript(command: string, output: string): string {
	// ANSI 颜色代码
	const colors = {
		green: "\x1b[32m", // 绿色 - 用于命令提示符
		brightBlack: "\x1b[90m", // 亮黑色/灰色 - 用于注释
		blue: "\x1b[34m", // 蓝色 - 用于命令
		reset: "\x1b[0m", // 重置颜色
	}
	// 处理多行命令
	const lines = command.split("\n").map((line) => {
		if (!line.trim()) return ""
		// 对于非空行，如果是注释则直接显示，否则加上 $ 前缀
		if (line.trim().startsWith("#")) {
			// 注释用亮黑色（灰色）显示
			return `${colors.brightBlack}${line}${colors.reset}`
		}
		// 命令提示符用绿色，命令本身用蓝色
		return `${colors.green}$${colors.reset} ${colors.blue}${line}${colors.reset}`
	})
	return `${lines.join("\n")}\n\n${output}`
}
