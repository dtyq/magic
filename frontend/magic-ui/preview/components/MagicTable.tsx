import React from "react"
import MagicTable from "../../components/MagicTable"
import ComponentDemo from "./Container"

const TableDemo: React.FC = () => {
	const dataSource = [
		{
			key: "1",
			name: "张三",
			age: 32,
			address: "北京市朝阳区",
			tags: ["开发", "前端"],
		},
		{
			key: "2",
			name: "李四",
			age: 42,
			address: "上海市浦东新区",
			tags: ["设计", "UI"],
		},
		{
			key: "3",
			name: "王五",
			age: 28,
			address: "广州市天河区",
			tags: ["测试", "QA"],
		},
	]

	const columns = [
		{
			title: "姓名",
			dataIndex: "name",
			key: "name",
		},
		{
			title: "年龄",
			dataIndex: "age",
			key: "age",
		},
		{
			title: "地址",
			dataIndex: "address",
			key: "address",
		},
		{
			title: "标签",
			key: "tags",
			dataIndex: "tags",
			render: (tags: string[]) => (
				<>
					{tags.map((tag) => (
						<span key={tag} style={{ marginRight: 8, color: "#1890ff" }}>
							{tag}
						</span>
					))}
				</>
			),
		},
	]

	return (
		<div>
			<ComponentDemo
				title="基础表格"
				description="最基本的表格组件"
				code="<MagicTable columns={columns} dataSource={dataSource} />"
			>
				<MagicTable columns={columns} dataSource={dataSource} />
			</ComponentDemo>

			<ComponentDemo
				title="带分页的表格"
				description="支持分页功能的表格"
				code="pagination: { pageSize: 2 }"
			>
				<MagicTable
					columns={columns}
					dataSource={dataSource}
					pagination={{ pageSize: 2 }}
				/>
			</ComponentDemo>

			<ComponentDemo title="可选择的表格" description="支持行选择的表格" code="rowSelection">
				<MagicTable
					columns={columns}
					dataSource={dataSource}
					rowSelection={{
						onChange: (selectedRowKeys, selectedRows) => {
							console.log("选中的行:", selectedRowKeys, selectedRows)
						},
					}}
				/>
			</ComponentDemo>

			<ComponentDemo
				title="可排序的表格"
				description="支持列排序的表格"
				code="sorter: (a, b) => a.age - b.age"
			>
				<MagicTable
					columns={[
						...columns.slice(0, 2),
						{
							title: "年龄",
							dataIndex: "age",
							key: "age",
							sorter: (a, b) => a.age - b.age,
						},
						...columns.slice(2),
					]}
					dataSource={dataSource}
				/>
			</ComponentDemo>

			<ComponentDemo
				title="加载状态的表格"
				description="支持加载状态的表格"
				code="loading: true"
			>
				<MagicTable columns={columns} dataSource={dataSource} loading={true} />
			</ComponentDemo>
		</div>
	)
}

export default TableDemo
