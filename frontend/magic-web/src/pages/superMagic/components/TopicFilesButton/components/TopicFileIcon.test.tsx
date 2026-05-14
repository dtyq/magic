import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import fileAudioIcon from "../assets/file-audio.svg"
import fileExcelIcon from "../assets/file-excel.svg"
import fileImageIcon from "../assets/file-image.svg"
import fileJsIcon from "../assets/file-js.svg"
import fileLinkIcon from "../assets/file-link.svg"
import fileOtherIcon from "../assets/file-other.svg"
import filePdfIcon from "../assets/file-pdf.svg"
import fileTxtIcon from "../assets/file-txt.svg"
import fileVideoIcon from "../assets/file-video.svg"
import fileWordIcon from "../assets/file-word.svg"
import fileZipIcon from "../assets/file-zip.svg"
import folderNonEmptyIcon from "../assets/folder-non-empty-icon.svg"
import magicSystemFolderIcon from "../assets/magic-system-folder-icon.svg"
import { TopicFileIcon } from "./TopicFileIcon"

describe("TopicFileIcon", () => {
	it("renders the txt icon for txt files", () => {
		render(<TopicFileIcon fileExtension="txt" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileTxtIcon)
	})

	it("renders the fallback icon for unknown file extensions", () => {
		render(<TopicFileIcon fileExtension="unknown" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileOtherIcon)
	})

	it("renders the pdf icon for pdf files", () => {
		render(<TopicFileIcon fileExtension="pdf" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", filePdfIcon)
	})

	it("renders the word icon for docx files", () => {
		render(<TopicFileIcon fileExtension="docx" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileWordIcon)
	})

	it("renders the excel icon for spreadsheet files", () => {
		render(<TopicFileIcon fileExtension="xlsx" dataTestId="topic-files-file-icon" />)
		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileExcelIcon)

		render(<TopicFileIcon fileExtension="csv" dataTestId="topic-files-file-icon" />)
		expect(screen.getAllByTestId("topic-files-file-icon")[1]).toHaveAttribute(
			"src",
			fileExcelIcon,
		)
	})

	it("renders the js icon for ts and tsx files", () => {
		render(<TopicFileIcon fileExtension="ts" dataTestId="topic-files-file-icon" />)
		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileJsIcon)

		render(<TopicFileIcon fileExtension="tsx" dataTestId="topic-files-file-icon" />)
		expect(screen.getAllByTestId("topic-files-file-icon")[1]).toHaveAttribute("src", fileJsIcon)
	})

	it("renders the image icon for png files", () => {
		render(<TopicFileIcon fileExtension="png" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileImageIcon)
	})

	it("renders the video icon for mp4 files", () => {
		render(<TopicFileIcon fileExtension="mp4" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileVideoIcon)
	})

	it("renders the audio icon for mp3 files", () => {
		render(<TopicFileIcon fileExtension="mp3" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileAudioIcon)
	})

	it("renders the zip icon for common archive files", () => {
		render(<TopicFileIcon fileExtension="zip" dataTestId="topic-files-file-icon" />)
		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileZipIcon)

		render(<TopicFileIcon fileExtension="rar" dataTestId="topic-files-file-icon" />)
		expect(screen.getAllByTestId("topic-files-file-icon")[1]).toHaveAttribute(
			"src",
			fileZipIcon,
		)

		render(<TopicFileIcon fileExtension="7z" dataTestId="topic-files-file-icon" />)
		expect(screen.getAllByTestId("topic-files-file-icon")[2]).toHaveAttribute(
			"src",
			fileZipIcon,
		)
	})

	it("renders the link icon for url files", () => {
		render(<TopicFileIcon fileExtension="url" dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", fileLinkIcon)
	})

	it("normalizes dotted and uppercase file extensions before mapping icons", () => {
		render(<TopicFileIcon fileExtension=".PDF" dataTestId="topic-files-file-icon" />)
		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute("src", filePdfIcon)

		render(<TopicFileIcon fileExtension=".Tsx" dataTestId="topic-files-file-icon" />)
		expect(screen.getAllByTestId("topic-files-file-icon")[1]).toHaveAttribute("src", fileJsIcon)
	})

	it("renders the non-empty folder icon for folders with children", () => {
		render(<TopicFileIcon isDirectory hasChildren dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute(
			"src",
			folderNonEmptyIcon,
		)
	})

	it("renders the magic folder icon for magic system folders", () => {
		render(<TopicFileIcon isDirectory isMagicFolder dataTestId="topic-files-file-icon" />)

		expect(screen.getByTestId("topic-files-file-icon")).toHaveAttribute(
			"src",
			magicSystemFolderIcon,
		)
	})
})
