"""内容产出结果类型。"""

from enum import StrEnum


class ProductionResultType(StrEnum):
    """显式区分单 Content、批量导入和批量生成结果。"""

    SINGLE_CONTENT = "single_content"
    BATCH_IMPORT = "batch_import"
    BATCH_GENERATION = "batch_generation"
