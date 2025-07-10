import React from "react"
import { Space } from "antd"
import MagicSearch from "../../components/MagicSearch"
import ComponentDemo from "./Container"

const SearchDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础搜索"
				description="最基本的搜索组件"
				code="<MagicSearch placeholder='请输入搜索内容' />"
			>
				<Space>
					<MagicSearch placeholder="请输入搜索内容" style={{ width: 300 }} />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持不同尺寸的搜索框"
				code="size: 'large' | 'middle' | 'small'"
			>
				<Space direction="vertical">
					<MagicSearch placeholder="大尺寸搜索框" size="large" style={{ width: 300 }} />
					<MagicSearch placeholder="默认尺寸搜索框" style={{ width: 300 }} />
					<MagicSearch placeholder="小尺寸搜索框" size="small" style={{ width: 300 }} />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="事件处理"
				description="监听搜索和输入事件"
				code="onSearch | onChange"
			>
				<Space direction="vertical">
					<MagicSearch
						placeholder="输入时触发onChange"
						style={{ width: 300 }}
						onChange={(e) => console.log("输入内容:", e.target.value)}
					/>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default SearchDemo
