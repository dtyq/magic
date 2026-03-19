import { memo } from "react"
import { Flex } from "antd"
import { createStyles } from "antd-style"

// Components
import MagicAvatar from "@/components/base/MagicAvatar"
import MagicInfiniteList from "../index"

// Types
import type { Friend } from "@/types/contact"

// Utils
import { getUserName } from "@/utils/modules/chat"

// Stores
import userInfoStore from "@/stores/userInfo"
import contactStore from "@/stores/contact"
import userInfoService from "@/services/userInfo"

const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			height: 400px;
			border: 1px solid #d9d9d9;
			border-radius: 8px;
			overflow: hidden;
		`,

		// Custom item styles
		customItem: css`
			padding: 16px;
			margin: 8px 16px;
			background: linear-gradient(135deg, ${token.colorPrimary}10, ${token.colorBgContainer});
			border: 2px solid ${token.colorPrimary}20;
			border-radius: 12px;
			box-shadow: 0 2px 8px ${token.colorPrimary}10;
			transition: all 0.3s ease;

			&:hover {
				transform: translateY(-2px);
				box-shadow: 0 4px 16px ${token.colorPrimary}20;
				border-color: ${token.colorPrimary};
			}

			&:last-child {
				margin-bottom: 16px;
			}
		`,

		// Minimal item styles
		minimalItem: css`
			padding: 8px 16px;
			border-bottom: 1px solid ${token.colorBorderSecondary};

			&:hover {
				background-color: ${token.colorBgTextHover};
			}

			&:last-child {
				border-bottom: none;
			}
		`,

		// Card-like item styles
		cardItem: css`
			margin: 12px;
			padding: 20px;
			background-color: ${token.colorBgContainer};
			border-radius: 16px;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
			border: 1px solid ${token.colorBorder};
			transition: all 0.2s ease;

			&:hover {
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				transform: translateY(-1px);
			}
		`,
	}
})

/**
 * StyledUsage - Styled usage examples of MagicInfiniteList
 *
 * This example shows different styling approaches for list items
 */
const StyledUsage = memo(() => {
	const { styles } = useStyles()

	// Data fetcher function
	const fetchFriends = async (params: { page_token?: string } = {}) => {
		const result = await contactStore.getFriends(params)

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
			<Flex align="center" gap={12} onClick={handleClick}>
				<MagicAvatar src={user?.avatar_url} size={40}>
					{getUserName(user)}
				</MagicAvatar>
				<div>
					<div style={{ fontWeight: 600, marginBottom: 4 }}>
						{user?.real_name || friend.friend_id}
					</div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>ID: {friend.friend_id}</div>
				</div>
			</Flex>
		)
	}

	return (
		<div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
			{/* Default Styling */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>默认样式</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
					/>
				</div>
			</div>

			{/* Custom Gradient Styling */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>自定义渐变样式</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
						useDefaultItemStyles={false}
						itemClassName={styles.customItem}
					/>
				</div>
			</div>

			{/* Minimal Styling */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>极简样式</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
						useDefaultItemStyles={false}
						itemClassName={styles.minimalItem}
					/>
				</div>
			</div>

			{/* Card Styling */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>卡片样式</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
						useDefaultItemStyles={false}
						itemClassName={styles.cardItem}
					/>
				</div>
			</div>

			{/* Combined Styling */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>组合样式（默认+自定义）</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
						useDefaultItemStyles={true}
						itemClassName="additional-custom-class"
						itemStyle={{
							borderLeft: "4px solid #1890ff",
							backgroundColor: "#f6ffed",
						}}
					/>
				</div>
			</div>

			{/* Inline Style Only */}
			<div style={{ flex: "1", minWidth: "300px" }}>
				<h3>仅内联样式</h3>
				<div className={styles.container}>
					<MagicInfiniteList<Friend>
						dataFetcher={fetchFriends}
						renderItem={renderFriend}
						getItemKey={(friend: Friend) => friend.friend_id}
						useDefaultItemStyles={false}
						itemStyle={{
							padding: "12px 20px",
							margin: "4px 8px",
							backgroundColor: "#fff2e8",
							border: "1px solid #ffbb96",
							borderRadius: "6px",
							cursor: "pointer",
						}}
					/>
				</div>
			</div>
		</div>
	)
})

StyledUsage.displayName = "StyledUsage"

export default StyledUsage
