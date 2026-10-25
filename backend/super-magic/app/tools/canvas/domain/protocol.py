"""Canvas 3.0 Element 与 Content 的协议字段目录。"""

from app.tools.canvas.domain.content_fields.generated_media_protocol import generated_content_fields

SUPPORTED_ELEMENT_TYPES = {
    "frame", "group", "image", "text", "rectangle", "ellipse", "triangle", "star",
    "video", "audio", "storyboard", "video-edit",
}
BASE_ELEMENT_FIELDS = {
    "id", "name", "type", "visible", "locked", "opacity", "x", "y", "width", "height",
    "scaleX", "scaleY", "zIndex", "interactionConfig", "contents", "activeContentId", "mainContentId",
}
CONTENT_FIELDS = {
    "frame": set(),
    "group": set(),
    "image": set(generated_content_fields("image")) | {"discarded"},
    "video": set(generated_content_fields("video")),
    "audio": {"src"},
    "text": {"content", "defaultStyle"},
    "rectangle": {"fill", "stroke", "strokeWidth", "cornerRadius"},
    "ellipse": {"fill", "stroke", "strokeWidth"},
    "triangle": {"fill", "stroke", "strokeWidth"},
    "star": {"fill", "stroke", "strokeWidth", "cornerRadius", "sides", "innerRadiusRatio"},
    "storyboard": {"generationConfig", "shots"},
    "video-edit": {"videoSequence", "audioSequence"},
}
