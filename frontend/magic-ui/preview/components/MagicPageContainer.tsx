import React from "react"
import MagicPageContainer from "../../components/MagicPageContainer"
import ComponentDemo from "./Container"
import { Button } from "antd"

const PageContainerDemo: React.FC = () => {
	return (
		<div>
			<ComponentDemo
				title="基础页面容器"
				description="最基本的页面容器组件"
				code="<MagicPageContainer title='页面标题'><div>内容</div></MagicPageContainer>"
			>
				<MagicPageContainer title="页面标题">
					<p>这是页面容器的内容区域。</p>
					<p>可以包含任何React组件和内容。</p>
				</MagicPageContainer>
			</ComponentDemo>

			<ComponentDemo title="带副标题" description="支持副标题的页面容器" code="subTitle">
				<MagicPageContainer title="页面标题" extra={<div>页面副标题</div>}>
					<p>这是带副标题的页面容器。</p>
				</MagicPageContainer>
			</ComponentDemo>

			<ComponentDemo title="带标签页" description="支持标签页的页面容器" code="tabList">
				<MagicPageContainer
					title="页面标题"
					tabList={[
						{ key: "tab1", tab: "标签1" },
						{ key: "tab2", tab: "标签2" },
						{ key: "tab3", tab: "标签3" },
					]}
				>
					<p>这是带标签页的页面容器。</p>
				</MagicPageContainer>
			</ComponentDemo>

			<ComponentDemo title="带操作按钮" description="支持操作按钮的页面容器" code="extra">
				<MagicPageContainer
					title="页面标题"
					extra={[
						<Button key="1" style={{ marginRight: 8 }}>
							操作1
						</Button>,
						<Button key="2" type="primary">
							操作2
						</Button>,
					]}
				>
					<p>这是带操作按钮的页面容器。</p>
				</MagicPageContainer>
			</ComponentDemo>
		</div>
	)
}

export default PageContainerDemo
