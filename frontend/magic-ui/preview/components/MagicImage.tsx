import React from "react"
import { Space } from "antd"
import MagicImage from "../../components/MagicImage"
import ComponentDemo from "./Container"

const ImageDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础用法"
				description="支持所有原生 img 标签的属性，使用方式与普通 img 标签一致"
				code="src: string"
			>
				<Space wrap>
					<MagicImage
						src="https://picsum.photos/200/150?random=1"
						alt="随机图片1"
						width={200}
						height={150}
						style={{ borderRadius: "8px" }}
					/>
					<MagicImage
						src="https://picsum.photos/200/150?random=2"
						alt="随机图片2"
						width={200}
						height={150}
						style={{ borderRadius: "8px" }}
					/>
					<MagicImage
						src="https://picsum.photos/200/150?random=3"
						alt="随机图片3"
						width={200}
						height={150}
						style={{ borderRadius: "8px" }}
					/>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="错误回退"
				description="当图片加载失败时，会自动显示 errorSrc 指定的图片"
				code="errorSrc: string"
			>
				<Space wrap>
					<MagicImage
						src="invalid-url"
						errorSrc="https://picsum.photos/200/150?random=fallback"
						alt="错误回退示例"
						width={200}
						height={150}
						style={{ borderRadius: "8px" }}
					/>
					<MagicImage
						src="https://picsum.photos/200/150?random=4"
						errorSrc="https://picsum.photos/200/150?random=fallback2"
						alt="正常图片"
						width={200}
						height={150}
						style={{ borderRadius: "8px" }}
					/>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default ImageDemo
