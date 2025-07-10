import React from "react"
import { Space } from "antd"
import MagicFileIcon from "../../components/MagicFileIcon"
import ComponentDemo from "./Container"

const FileIconDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础文件图标"
				description="最基本的文件图标组件"
				code="<MagicFileIcon type='pdf' />"
			>
				<Space>
					<MagicFileIcon type="pdf" />
					<MagicFileIcon type="doc" />
					<MagicFileIcon type="xls" />
					<MagicFileIcon type="ppt" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="文档类型"
				description="支持各种文档类型"
				code="type: 'pdf' | 'doc' | 'xls' | 'ppt' | 'txt'"
			>
				<Space wrap>
					<MagicFileIcon type="pdf" />
					<MagicFileIcon type="doc" />
					<MagicFileIcon type="xls" />
					<MagicFileIcon type="ppt" />
					<MagicFileIcon type="txt" />
					<MagicFileIcon type="markdown" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="媒体类型"
				description="支持各种媒体文件类型"
				code="type: 'image' | 'video' | 'audio'"
			>
				<Space wrap>
					<MagicFileIcon type="image" />
					<MagicFileIcon type="video" />
					<MagicFileIcon type="audio" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="代码类型"
				description="支持各种代码文件类型"
				code="type: 'code' | 'json' | 'xml' | 'html' | 'css' | 'js'"
			>
				<Space wrap>
					<MagicFileIcon type="code" />
					<MagicFileIcon type="json" />
					<MagicFileIcon type="xml" />
					<MagicFileIcon type="html" />
					<MagicFileIcon type="css" />
					<MagicFileIcon type="js" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="其他类型"
				description="支持其他文件类型"
				code="type: 'folder' | 'zip' | 'link' | 'other'"
			>
				<Space wrap>
					<MagicFileIcon type="folder" />
					<MagicFileIcon type="zip" />
					<MagicFileIcon type="link" />
					<MagicFileIcon type="other" />
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸"
				description="支持不同尺寸的文件图标"
				code="size: number | string"
			>
				<Space>
					<MagicFileIcon type="pdf" size={16} />
					<MagicFileIcon type="pdf" size={24} />
					<MagicFileIcon type="pdf" size={32} />
					<MagicFileIcon type="pdf" size={48} />
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default FileIconDemo
