import React, { useState } from "react"
import { Space, Button } from "antd"
import MagicModal from "../../components/MagicModal"
import MagicButton from "../../components/MagicButton"
import ComponentDemo from "./Container"

const ModalDemo: React.FC = () => {
	const [isModalOpen1, setIsModalOpen1] = useState(false)
	const [isModalOpen2, setIsModalOpen2] = useState(false)
	const [isModalOpen4, setIsModalOpen4] = useState(false)

	return (
		<div>
			<ComponentDemo
				title="基础模态框"
				description="最基本的模态框组件"
				code="<MagicModal open={isOpen} onCancel={() => setIsOpen(false)} />"
			>
				<Space>
					<MagicButton type="primary" onClick={() => setIsModalOpen1(true)}>
						打开基础模态框
					</MagicButton>
					<MagicModal
						title="基础模态框"
						open={isModalOpen1}
						onCancel={() => setIsModalOpen1(false)}
						onOk={() => setIsModalOpen1(false)}
					>
						<p>这是一个基础模态框的内容示例。</p>
						<p>点击确定或取消按钮可以关闭模态框。</p>
					</MagicModal>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="不同尺寸的模态框"
				description="支持不同尺寸的模态框"
				code="width: number | string"
			>
				<Space>
					<MagicButton onClick={() => setIsModalOpen2(true)}>小尺寸模态框</MagicButton>
					<MagicModal
						title="小尺寸模态框"
						open={isModalOpen2}
						width={400}
						onCancel={() => setIsModalOpen2(false)}
						onOk={() => setIsModalOpen2(false)}
					>
						<p>这是一个宽度为400px的小尺寸模态框。</p>
					</MagicModal>
				</Space>
			</ComponentDemo>

			<ComponentDemo
				title="无按钮模态框"
				description="可以隐藏默认的确定和取消按钮"
				code="footer: null"
			>
				<Space>
					<MagicButton onClick={() => setIsModalOpen4(true)}>无按钮模态框</MagicButton>
					<MagicModal
						title="无按钮模态框"
						open={isModalOpen4}
						footer={null}
						onCancel={() => setIsModalOpen4(false)}
					>
						<p>这个模态框没有默认的按钮。</p>
						<p>只能通过点击右上角的关闭按钮或遮罩层来关闭。</p>
						<div style={{ textAlign: "right", marginTop: 16 }}>
							<Button onClick={() => setIsModalOpen4(false)}>自定义关闭按钮</Button>
						</div>
					</MagicModal>
				</Space>
			</ComponentDemo>
		</div>
	)
}

export default ModalDemo
