import { render, screen } from "@testing-library/react"
import MagicThemeProvider from "../../ThemeProvider"
import { describe, it, expect } from "vitest"
import MagicTable from "../index"

const renderWithTheme = (component: React.ReactElement) =>
	render(<MagicThemeProvider theme="light">{component}</MagicThemeProvider>)

describe("MagicTable", () => {
	it("应该正常渲染", () => {
		renderWithTheme(
			<MagicTable
				columns={[
					{ title: "姓名", dataIndex: "name", key: "name" },
					{ title: "年龄", dataIndex: "age", key: "age" },
				]}
				dataSource={[
					{ key: "1", name: "张三", age: 25 },
					{ key: "2", name: "李四", age: 30 },
				]}
			/>,
		)
		expect(screen.getByText("姓名")).toBeInTheDocument()
		expect(screen.getByText("年龄")).toBeInTheDocument()
		expect(screen.getByText("张三")).toBeInTheDocument()
		expect(screen.getByText("李四")).toBeInTheDocument()
	})

	// 快照测试
	describe("快照测试", () => {
		it("基础表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name" },
						{ title: "年龄", dataIndex: "age", key: "age" },
					]}
					dataSource={[
						{ key: "1", name: "张三", age: 25 },
						{ key: "2", name: "李四", age: 30 },
					]}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("空数据表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name" },
						{ title: "年龄", dataIndex: "age", key: "age" },
					]}
					dataSource={[]}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带分页表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name" },
						{ title: "年龄", dataIndex: "age", key: "age" },
					]}
					dataSource={[
						{ key: "1", name: "张三", age: 25 },
						{ key: "2", name: "李四", age: 30 },
					]}
					pagination={{ current: 1, pageSize: 10, total: 2 }}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带排序表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name", sorter: true },
						{ title: "年龄", dataIndex: "age", key: "age", sorter: true },
					]}
					dataSource={[
						{ key: "1", name: "张三", age: 25 },
						{ key: "2", name: "李四", age: 30 },
					]}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("带选择框表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					rowSelection={{}}
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name" },
						{ title: "年龄", dataIndex: "age", key: "age" },
					]}
					dataSource={[
						{ key: "1", name: "张三", age: 25 },
						{ key: "2", name: "李四", age: 30 },
					]}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})

		it("紧凑型表格快照", () => {
			const { asFragment } = renderWithTheme(
				<MagicTable
					size="small"
					columns={[
						{ title: "姓名", dataIndex: "name", key: "name" },
						{ title: "年龄", dataIndex: "age", key: "age" },
					]}
					dataSource={[
						{ key: "1", name: "张三", age: 25 },
						{ key: "2", name: "李四", age: 30 },
					]}
				/>,
			)
			expect(asFragment()).toMatchSnapshot()
		})
	})
})
