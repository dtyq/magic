import { makeAutoObservable } from "mobx"

class AiCompletion {
	suggestion: string = ""

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setSuggestion(suggestion: string) {
		this.suggestion = suggestion
	}

	clearSuggestion() {
		this.suggestion = ""
	}
}

const AiCompletionStore = new AiCompletion()

export default AiCompletionStore
