"""文件类型常量定义"""

# document-converter 建议交由 Skill 工作流处理的复杂文件类型
CONVERTIBLE_EXTENSIONS = {
    # PDF文件
    '.pdf',
    # Office文档
    '.doc', '.docx', '.docm',
    '.dot', '.dotx', '.dotm',
    '.odt', '.rtf',
    '.wps', '.wpt',  # Word/WPS文档
    '.xls', '.xlsx', '.xlsm', '.xlsb',
    '.xlt', '.xltx', '.xltm',
    '.ods',
    '.et', '.ett',  # Excel/WPS表格
    '.ppt', '.pptx', '.pptm',
    '.pps', '.ppsx', '.ppsm',
    '.pot', '.potx', '.potm',
    '.odp',
    '.dps', '.dpt',  # PowerPoint/WPS演示文稿
    # 其他格式
    '.csv', '.tsv',  # 表格文本文件
    '.ipynb',  # Jupyter Notebook
    # 图片文件
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp'
}

# 建议优先转换后阅读的文件类型（用户体验更好）
CONVERSION_RECOMMENDED_TYPES = {
    '.pdf',      # PDF文件最好转换后阅读
    '.pptx',     # PowerPoint演示文稿转换后更易阅读
    '.ppt',      # 旧版PowerPoint
    '.pptm', '.pps', '.ppsx', '.ppsm',
    '.pot', '.potx', '.potm',
    '.odp',
    '.dps', '.dpt',
    '.ipynb',    # Jupyter Notebook转换后代码和文本分离清晰
}

# 不支持转换的纯文本文件类型
TEXT_EXTENSIONS = {
    '.txt', '.md', '.py', '.js', '.ts', '.java', '.cpp', '.c',
    '.go', '.rs', '.php', '.rb', '.html', '.htm', '.css',
    '.xml', '.json', '.yaml', '.yml', '.toml', '.conf',
    '.properties', '.ini', '.cfg', '.log', '.sh', '.bat'
}
