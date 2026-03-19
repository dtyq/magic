import { SetStateAction, useState } from "react"
import VoiceInput from "@/components/business/VoiceInput"
import { Button } from "antd"

function VoiceInputAdvancedExample() {
	const [text, setText] = useState("")
	const [status, setStatus] = useState("idle")

	const handleResult = (result: string) => {
		setText(result)
	}

	const handleStatusChange = (status: SetStateAction<string>) => {
		setStatus(status)
		console.log("状态变化:", status)
	}

	return (
		<div>
			<VoiceInput
				onResult={handleResult}
				onStatusChange={handleStatusChange}
				placeholder="点击开始语音输入"
				config={{
					audio: {
						sampleRate: 16000,
						channelCount: 1,
						bitsPerSample: 16,
					},
				}}
			/>
			<div>当前状态: {status}</div>
			<textarea value={text} />
			<Button onClick={() => setText("")}>清空</Button>
		</div>
	)
}

export default VoiceInputAdvancedExample
