import { memo } from "react"
import { Flex } from "antd"
import { observer } from "mobx-react-lite"

// Components
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import MagicInfiniteList from "../index"

// Types
import type { Friend } from "@/opensource/types/contact"

// Utils
import { getUserName } from "@/opensource/utils/modules/chat"

// Stores
import userInfoStore from "@/opensource/stores/userInfo"
import contactStore from "@/opensource/stores/contact"
import userInfoService from "@/opensource/services/userInfo"

/**
 * BasicUsage - Basic usage example of MagicInfiniteList
 *
 * This example shows how to use MagicInfiniteList with friends data
 */
const BasicUsage = memo(
	observer(() => {
		// Data fetcher function
		const fetchFriends = async (params: { page_token?: string } = {}) => {
			const result = await contactStore.getFriends(params)

			// Fetch user info for friends that don't have it
			if (result && result?.items?.length > 0) {
				const unUserInfos = result?.items?.filter(
					(item: Friend) => !userInfoStore.get(item.friend_id),
				)
				if (unUserInfos.length > 0) {
					await userInfoService
						.fetchUserInfos(
							unUserInfos.map((item: Friend) => item.friend_id),
							2,
						)
						.catch(() => {
							console.log("fetchUserInfos error", unUserInfos)
						})
				}
			}

			return (
				result || {
					items: [],
					has_more: false,
					page_token: "",
				}
			)
		}

		// Item render function
		const renderFriend = (friend: Friend) => {
			const user = userInfoStore.get(friend.friend_id)

			const handleClick = () => {
				console.log("Friend clicked:", friend)
			}

			return (
				<Flex align="center" gap={10} onClick={handleClick}>
					<MagicAvatar src={user?.avatar_url} size={30}>
						{getUserName(user)}
					</MagicAvatar>
					<div>{user?.real_name || friend.friend_id}</div>
				</Flex>
			)
		}

		return (
			<div style={{ height: "400px", border: "1px solid #d9d9d9" }}>
				<MagicInfiniteList<Friend>
					dataFetcher={fetchFriends}
					renderItem={renderFriend}
					getItemKey={(friend: Friend) => friend.friend_id}
				/>
			</div>
		)
	}),
)

BasicUsage.displayName = "BasicUsage"

export default BasicUsage
