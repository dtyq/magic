import React from "react"
import ButtonDemo from "../components/MagicButton"
import SwitchDemo from "../components/MagicSwitch"
import CheckFavorDemo from "../components/MagicCheckFavor"
import EllipseDemo from "../components/MagicEllipse"
import TagDemo from "../components/MagicTag"
import ModalDemo from "../components/MagicModal"
import TableDemo from "../components/MagicTable"
import SearchDemo from "../components/MagicSearch"
import SelectDemo from "../components/MagicSelect"
import SpinDemo from "../components/MagicSpin"
import SegmentedDemo from "../components/MagicSegmented"
import CollapseDemo from "../components/MagicCollapse"
import SplitterDemo from "../components/MagicSplitter"
import MenuDemo from "../components/MagicMenu"
import IconDemo from "../components/MagicIcon"
import FileIconDemo from "../components/MagicFileIcon"
import DropdownDemo from "../components/MagicDropdown"
import PageContainerDemo from "../components/MagicPageContainer"
import AvatarDemo from "../components/MagicAvatar"
import ImageDemo from "../components/MagicImage"

export const COMPONENTS = [
	{
		key: "avatar",
		label: "头像 Avatar",
		element: <AvatarDemo />,
	},
	{
		key: "image",
		label: "图片 Image",
		element: <ImageDemo />,
	},
	{
		key: "button",
		label: "按钮 Button",
		element: <ButtonDemo />,
	},
	{
		key: "switch",
		label: "开关 Switch",
		element: <SwitchDemo />,
	},
	{
		key: "checkfavor",
		label: "收藏 CheckFavor",
		element: <CheckFavorDemo />,
	},
	{
		key: "ellipse",
		label: "省略号 Ellipse",
		element: <EllipseDemo />,
	},
	{
		key: "tag",
		label: "标签 Tag",
		element: <TagDemo />,
	},
	{
		key: "modal",
		label: "模态框 Modal",
		element: <ModalDemo />,
	},
	{
		key: "table",
		label: "表格 Table",
		element: <TableDemo />,
	},
	{
		key: "search",
		label: "搜索 Search",
		element: <SearchDemo />,
	},
	{
		key: "select",
		label: "选择器 Select",
		element: <SelectDemo />,
	},
	{
		key: "spin",
		label: "加载 Spin",
		element: <SpinDemo />,
	},
	{
		key: "segmented",
		label: "分段控制器 Segmented",
		element: <SegmentedDemo />,
	},
	{
		key: "collapse",
		label: "折叠面板 Collapse",
		element: <CollapseDemo />,
	},
	{
		key: "splitter",
		label: "分割器 Splitter",
		element: <SplitterDemo />,
	},
	{
		key: "menu",
		label: "菜单 Menu",
		element: <MenuDemo />,
	},
	{
		key: "icon",
		label: "图标 Icon",
		element: <IconDemo />,
	},
	{
		key: "fileicon",
		label: "文件图标 FileIcon",
		element: <FileIconDemo />,
	},
	{
		key: "dropdown",
		label: "下拉菜单 Dropdown",
		element: <DropdownDemo />,
	},
	{
		key: "pagecontainer",
		label: "页面容器 PageContainer",
		element: <PageContainerDemo />,
	},
]
