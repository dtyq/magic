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
        return (
            "User marked a specific area on a Canvas image for modification. "
            "Use canvas project skill or tools to process the image based on the design marker."
        )

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        image_path = self.normalize_path(mention.get("image", ""))
        label = mention.get("label", "")
        bbox = mention.get("bbox")

        context_lines = [
            f"{index}. [@design_marker:{label}]",
            f"   - Image location: {image_path}",
        ]

        if self._is_valid_bbox(bbox):
            bbox_lines = self._build_bbox_context(bbox, label, image_path)
            context_lines.extend(bbox_lines)
        else:
            logger.info(f"用户prompt添加设计标记引用: {label} at {image_path} (未指定具体区域)")

        return context_lines

    @staticmethod
    def _is_valid_bbox(bbox: Any) -> bool:
        return (
            bbox is not None
            and bbox != {}
            and bbox != []
            and isinstance(bbox, dict)
            and len(bbox) > 0
        )

    @staticmethod
    def _build_bbox_context(bbox: Dict[str, float], label: str, image_path: str) -> List[str]:
        x = bbox.get("x", 0)
        y = bbox.get("y", 0)
        width = bbox.get("width", 0)
        height = bbox.get("height", 0)

        # 中心点判断位置
        center_x = x + width / 2
        center_y = y + height / 2

        h_pos = "left" if center_x < 0.33 else ("right" if center_x > 0.67 else "center")
        v_pos = "top" if center_y < 0.33 else ("bottom" if center_y > 0.67 else "middle")
        # 组合成 "top right" / "bottom left" 等，center+middle 特殊处理
        if v_pos == "middle" and h_pos == "center":
            position_desc = "center of image"
        elif v_pos == "middle":
            position_desc = f"{h_pos} side of image"
        elif h_pos == "center":
            position_desc = f"{v_pos} center of image"
        else:
            position_desc = f"{v_pos} {h_pos} of image"

        area = width * height
        size_desc = "Large area" if area > 0.3 else ("Medium area" if area > 0.1 else "Small area")

        logger.info(f"用户prompt添加设计标记引用: {label} at {image_path} ({position_desc})")

        return [
            f"   - Marked area: {size_desc} at {position_desc}",
            f"   - Coordinates: Top left ({x * 100:.1f}%, {y * 100:.1f}%)",
        ]
