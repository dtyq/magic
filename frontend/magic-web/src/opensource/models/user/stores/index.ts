import { userStore as baseStore } from "./user.store"
import { accountStore } from "./account.store"
import { initializationStore } from "./initialization.store"

export class UserStore {
	user = baseStore

	account = accountStore

	initialization = initializationStore
}

export const userStore = new UserStore()
