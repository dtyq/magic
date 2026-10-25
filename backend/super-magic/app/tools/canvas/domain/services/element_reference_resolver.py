"""Canvas Element 引用解析服务。"""


class ElementReferenceResolver:
    """统一解析已有 Element ID 和当前批次 item_ref。"""

    @staticmethod
    def resolve(reference: str | None, created_elements: dict[str, str] | None = None) -> str | None:
        """优先解析同批次 item_ref，否则保留已有 Element ID。"""
        if reference is None:
            return None
        return (created_elements or {}).get(reference, reference)
