import { useState, useRef, useEffect } from "react"
import { Input } from "antd"
import type { InputRef } from "antd"
import { createStyles } from "antd-style"

const useStyles = createStyles(() => ({
	name: {
		fontSize: "14px",
	},
	nameSpan: {
		cursor: "pointer",
	},
}))

interface DesignNameEditorProps {
	name: string
	onNameChange?: (name: string) => void
	isReadOnly?: boolean
}

export function DesignNameEditor(props: DesignNameEditorProps) {
	const { name, onNameChange, isReadOnly = false } = props
	const { styles } = useStyles()

	const [isEditing, setIsEditing] = useState(false)
	const [editingName, setEditingName] = useState(name)
	const inputRef = useRef<InputRef>(null)

	useEffect(() => {
		setEditingName(name)
	}, [name])

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleNameClick = () => {
		if (isReadOnly) return
		setIsEditing(true)
		setEditingName(name)
	}

	const handleNameSubmit = () => {
		if (editingName.trim() !== name && onNameChange) {
			onNameChange(editingName.trim())
		}
		setIsEditing(false)
	}

	const handleNameBlur = () => {
		handleNameSubmit()
	}

	const handlePressEnter = () => {
		handleNameSubmit()
	}

	if (isEditing) {
		return (
			<Input
				ref={inputRef}
				value={editingName}
				onChange={(e) => setEditingName(e.target.value)}
				onBlur={handleNameBlur}
				onPressEnter={handlePressEnter}
				size="small"
			/>
		)
	}

	return (
		<span
			className={`${styles.name} ${!isReadOnly ? styles.nameSpan : ""}`}
			onClick={handleNameClick}
		>
			{name}
		</span>
	)
}
