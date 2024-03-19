"""Design marker mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger


class DesignMarkerHandler(BaseMentionHandler):
    """处理设计标记类型的mention

    设计标记：用户在图片上标记的区域
    bbox坐标系统：左上角为原点(0,0)，x向右增加，y向下增加，值为归一化坐标(0-1)
    bbox包含：x(左上角X坐标), y(左上角Y坐标), width(宽度), height(高度)
    注意：bbox 可能为 None、null、{}、[] 都表示不存在
    """

    def get_type(self) -> str:
        return "design_marker"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """设计标记类型的mention返回提示文本"""
        return "用户在 Canvas 画布图片上标记了需要修改的具体区域，需要使用画布项目管理技能或工具根据设计标记进行图片处理和精确修改"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理设计标记引用（异步）

        Args:
            mention: mention数据
            index: mention序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        image_path = mention.get('image', '')
        label = mention.get('label', '')
        kind = mention.get('kind', 'object')
        bbox = mention.get('bbox')

        # 标准化图片路径
        image_path = self.normalize_path(image_path)

        # 构建基本标记信息
        context_lines = [
            f"{index}. [@design_marker:{label}]",
            f"   - 图片位置: {image_path}",
            f"   - 标记类型: {kind}"
        ]

        # 判断 bbox 是否有效
        if self._is_valid_bbox(bbox):
            # 添加bbox详细信息
            bbox_lines = self._build_bbox_context(bbox, label, image_path)
            context_lines.extend(bbox_lines)
        else:
            # bbox 不存在或为空
            logger.info(f"用户prompt添加设计标记引用: {label} at {image_path} (未指定具体区域)")

        return context_lines

    @staticmethod
    def _is_valid_bbox(bbox: Any) -> bool:
        """判断bbox是否有效

        Args:
            bbox: bbox数据

        Returns:
            bool: 是否有效
        """
        return (
            bbox is not None and
            bbox != {} and
            bbox != [] and
            isinstance(bbox, dict) and
            len(bbox) > 0
        )

    @staticmethod
    def _build_bbox_context(bbox: Dict[str, float], label: str, image_path: str) -> List[str]:
        """构建bbox相关的上下文信息

        Args:
            bbox: bbox坐标数据
            label: 标记标签
            image_path: 图片路径

        Returns:
            List[str]: bbox相关的上下文行
        """
        # 解析 bbox 坐标（左上角为原点，x向右，y向下）
        x = bbox.get('x', 0)
        y = bbox.get('y', 0)
        width = bbox.get('width', 0)
        height = bbox.get('height', 0)

        # 计算中心点坐标
        center_x = x + width / 2
        center_y = y + height / 2

        # 生成区域位置描述（基于中心点位置）
        h_position = "左侧" if center_x < 0.33 else ("右侧" if center_x > 0.67 else "中间")
        v_position = "上方" if center_y < 0.33 else ("下方" if center_y > 0.67 else "中部")
        position_desc = f"图片{v_position}{h_position}"

        # 生成区域大小描述
        area = width * height
        size_desc = "大区域" if area > 0.3 else ("中等区域" if area > 0.1 else "小区域")

        logger.info(f"用户prompt添加设计标记引用: {label} at {image_path} ({position_desc})")

        return [
            f"   - 标记区域: {position_desc}的{size_desc}",
            f"   - bbox坐标: 左上角({x*100:.1f}%, {y*100:.1f}%), 尺寸{width*100:.1f}%×{height*100:.1f}%"
        ]
