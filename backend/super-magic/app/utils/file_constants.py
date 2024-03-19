"""文件类型常量定义"""

# ConvertToMarkdown 支持的所有可转换文件类型
CONVERTIBLE_EXTENSIONS = {
    # PDF文件
    '.pdf',
    # Office文档
    '.doc', '.docx',  # Word文档
    '.xls', '.xlsx',  # Excel文件
    '.ppt', '.pptx',  # PowerPoint演示文稿
    # 其他格式
    '.csv',  # CSV文件
    '.ipynb',  # Jupyter Notebook
    # 图片文件
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'
}

# 建议优先转换后阅读的文件类型（用户体验更好）
CONVERSION_RECOMMENDED_TYPES = {
    '.pdf',      # PDF文件最好转换后阅读
    '.pptx',     # PowerPoint演示文稿转换后更易阅读
    '.ppt',      # 旧版PowerPoint
    '.ipynb',    # Jupyter Notebook转换后代码和文本分离清晰
}

# 不支持转换的纯文本文件类型
TEXT_EXTENSIONS = {
    '.txt', '.md', '.py', '.js', '.ts', '.java', '.cpp', '.c',
    '.go', '.rs', '.php', '.rb', '.html', '.htm', '.css',
    '.xml', '.json', '.yaml', '.yml', '.toml', '.conf',
    '.properties', '.ini', '.cfg', '.log', '.sh', '.bat'
}
