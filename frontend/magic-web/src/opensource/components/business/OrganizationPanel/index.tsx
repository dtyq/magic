import { Checkbox, Flex } from "antd"
import type { MouseEventHandler } from "react"
import { memo, useMemo } from "react"
import {
	useControllableValue,
	useDeepCompareEffect,
	useMemoizedFn,
	useMount,
	useUpdateEffect,
} from "ahooks"
import { useTranslation } from "react-i18next"
import type {
	StructureItem,
	StructureItemType,
	WithIdAndDataType,
} from "@/opensource/types/organization"
import { cx } from "antd-style"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import type { CheckboxChangeEvent } from "antd/es/checkbox"
import { isArray } from "lodash-es"
import { isDepartment, isMember } from "./utils"
import Member from "./components/Member"
import Department from "./components/Department"
import { useStyles } from "./style"
import type { OrganizationSelectItem } from "./originTypes"
import type { OrganizationPanelProps } from "./types"
import OrganizationPanelEmpty from "./components/Empty"
import BreadCrumb from "./components/BreadCrumb"
import useOrganizationTree from "../MemberDepartmentSelector/hooks/useOrganizationTree"

/**
 * 组织架构面板
 */
const OrganizationPanel = memo(function OrganizationPanel(props: OrganizationPanelProps) {
	const {
		onItemClick = (_, next) => next(),
		itemArrow,
		footer,
		className,
		showMember = true,
		memberExtra,
		breadcrumbRightNode,
		checkboxOptions,
		memberNodeWrapper = (node) => node,
		style,
		listClassName,
	} = props

	const { t } = useTranslation("interface")

	const { styles } = useStyles()

	const [selectedPath = [], setSelectPath] = useControllableValue<{ id: string; name: string }[]>(
		props,
		{
			defaultValue: [],
			defaultValuePropName: "defaultSelectedPath",
			valuePropName: "selectedPath",
			trigger: "onChangeSelectedPath",
		},
	)

	useUpdateEffect(() => {
		if (props?.defaultSelectedPath) setSelectPath(props.defaultSelectedPath)
	}, [props?.defaultSelectedPath, setSelectPath])

	/**
	 * 增强 setSelectPath, 当选择路径发生变化时，清空已选中的组织架构
	 */
	const enchancedSetSelectPath = useMemoizedFn<Exclude<typeof setSelectPath, undefined>>(
		(path) => {
			setSelectPath?.(path)
		},
	)

	useDeepCompareEffect(() => {
		if (isArray(selectedPath)) enchancedSetSelectPath(selectedPath)
	}, [selectedPath])

	const {
		data = { departments: [], users: [] },
		isLoading,
		mutate,
	} = useOrganizationTree(
		selectedPath?.length > 0 ? selectedPath[selectedPath.length - 1].id : "-1",
		true,
	)

	useMount(() => {
		mutate()
	})

	const dataArray = useMemo(
		() => [...data.departments, ...data.users],
		[data.departments, data.users],
	)

	const emptyNode = useMemo(() => {
		return isLoading ? null : (
			<Flex align="center" justify="center" flex={1} className={styles.list}>
				<OrganizationPanelEmpty />
			</Flex>
		)
	}, [isLoading, styles.list])

	const [checkedList, onCheckedListChange] = useControllableValue<OrganizationSelectItem[]>(
		checkboxOptions,
		{
			valuePropName: "checked",
			trigger: "onChange",
			defaultValue: [],
		},
	)

	const checkAll =
		dataArray.length > 0 && dataArray.every((item) => checkedList.find((i) => i.id === item.id))
	const checkSome =
		!checkAll && dataArray.some((item) => checkedList.find((i) => i.id === item.id))

	const handleCheck = useMemoizedFn<
		(checked: boolean, item: OrganizationSelectItem, e: CheckboxChangeEvent) => void
	>((checked, item, e) => {
		e.stopPropagation()
		if (checked) {
			onCheckedListChange((prev) => [...prev, item])
		} else {
			onCheckedListChange((prev) => prev.filter((c) => c.id !== item.id))
		}
	})

	const handleCheckAll = useMemoizedFn((e: CheckboxChangeEvent) => {
		if (e.target.checked) {
			const checkedMap = new Map()
			checkedList.forEach((item) => checkedMap.set(`${item.dataType}-${item.id}`, item))

			const newItems = dataArray.filter(
				(item) =>
					!checkedMap.has(`${item.dataType}-${item.id}`) &&
					!checkboxOptions?.disabled?.some?.(
						(disabledItem) => disabledItem.id === item.id,
					),
			)

			if (newItems.length > 0) {
				onCheckedListChange([...checkedList, ...newItems])
			}
		} else {
			const dataArrayIds = new Set(dataArray.map((item) => item.id))
			onCheckedListChange(
				checkedList.filter(
					(c) =>
						!dataArrayIds.has(c.id) ||
						checkboxOptions?.disabled?.some?.(
							(disabledItem) => disabledItem.id === c.id,
						),
				),
			)
		}
	})

	const deparmentCanNext = useMemoizedFn(
		(node: WithIdAndDataType<StructureItem, StructureItemType.Department>) => {
			return !checkboxOptions || !checkboxOptions.checked?.some((item) => item.id === node.id)
		},
	)

	/**
	 * 点击树节点
	 */
	const handleClick = useMemoizedFn<MouseEventHandler<HTMLSpanElement>>((e) => {
		const { id } = e.currentTarget.dataset
		if (!data) return
		if (id) {
			const node = dataArray?.find((item) => item.id === id)
			if (node) {
				onItemClick?.(node, () => {
					if (
						/**
						 * 什么情况下可以点击进入下一级：
						 * 1. 是部门节点
						 * 2. 没有选中该部门
						 */
						isDepartment(node) &&
						deparmentCanNext(node)
					) {
						enchancedSetSelectPath([...(selectedPath ?? []), node])
					} else if (
						/**
						 * 点击成员节点，更新 Checkbox 选中状态
						 */
						isMember(node) &&
						/** 被禁用, 不选中 */
						!checkboxOptions?.disabled?.some((item) => item.id === node.id)
					) {
						if (checkboxOptions?.checked?.some((item) => item.id === node.id)) {
							onCheckedListChange(
								checkboxOptions.checked.filter((item) => item.id !== node.id),
							)
						} else {
							onCheckedListChange([...(checkboxOptions?.checked ?? []), node])
						}
					}
				})
			}
		}
	})

	/**
	 * 面包屑导航
	 */
	const Breadcrumb = useMemo(() => {
		return (
			<BreadCrumb
				selectedPath={selectedPath}
				onChangeSelectedPath={enchancedSetSelectPath}
				breadcrumbRightNode={breadcrumbRightNode}
			/>
		)
	}, [breadcrumbRightNode, enchancedSetSelectPath, selectedPath])

	return (
		<Flex vertical className={cx(styles.container, className)} style={style}>
			{Breadcrumb}
			{checkboxOptions ? (
				<div className={styles.selectAllWrapper}>
					<Checkbox
						indeterminate={checkSome}
						disabled={dataArray.length === 0}
						checked={checkAll}
						onChange={handleCheckAll}
					>
						{t("contacts.selectAll")}
					</Checkbox>
				</div>
			) : null}
			{dataArray && dataArray.length > 0 ? (
				<div className={cx(styles.list, listClassName)}>
					{dataArray?.map((item) => {
						const { id } = item
						return (
							<Flex gap={4} key={id} className={styles.listItem}>
								{checkboxOptions ? (
									<Checkbox
										disabled={checkboxOptions.disabled?.some(
											(i) => i.id === id,
										)}
										checked={checkedList?.some((c) => c.id === id)}
										onChange={(e) => handleCheck(e.target.checked, item, e)}
										style={{ paddingLeft: 10 }}
									/>
								) : null}
								{isDepartment(item) ? (
									<Flex key={id} flex={1} data-id={id} onClick={handleClick}>
										<Department
											showMemberCount={showMember}
											itemArrow={deparmentCanNext(item) ? itemArrow : false}
											// itemArrow={item.has_child ? itemArrow : false}
											data={item}
										/>
									</Flex>
								) : (
									memberNodeWrapper(
										<Flex key={id} flex={1} data-id={id} onClick={handleClick}>
											<Member extra={memberExtra} data={item} />
										</Flex>,
										item,
									)
								)}
							</Flex>
						)
					})}
				</div>
			) : (
				emptyNode
			)}
			{/* {userListReducerState.search ? userListNode() : structureNode()} */}
			{footer}
		</Flex>
	)
})

export default OrganizationPanel
