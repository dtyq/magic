import { makeAutoObservable } from "mobx"
import type { User } from "@/types/user"

export class AccountStore {
	accounts: Array<User.UserAccount> = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	getAccountByMagicId(magicId: string) {
		return this.accounts.find((acc) => acc.magic_id === magicId)
	}

	getAccountByAccessToken(accessToken: string) {
		return this.accounts.find((acc) => acc.access_token === accessToken)
	}

	/**
	 * @description Create account
	 */
	setAccount = (account: User.UserAccount) => {
		const exists = this.accounts.some((acc) => acc.magic_id === account.magic_id)
		if (!exists) {
			this.accounts.push(account)
		} else {
			this.updateAccount(account.magic_id, account)
		}
	}

	/**
	 * @description Remove account
	 */
	deleteAccount = (unionId: string) => {
		this.accounts = this.accounts.filter((o) => o.magic_id !== unionId)
	}

	/**
	 * @description Update account
	 */
	updateAccount = (unionId: string, updatedAccount: Partial<User.UserAccount>) => {
		const index = this.accounts.findIndex((acc) => acc.magic_id === unionId)
		if (index !== -1) {
			this.accounts[index] = {
				...this.accounts[index],
				...updatedAccount,
			}
		}
	}

	/**
	 * @description Clear account
	 */
	clearAccount() {
		this.accounts = []
	}
}

export const accountStore = new AccountStore()
