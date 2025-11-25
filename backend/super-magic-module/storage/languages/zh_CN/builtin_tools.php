<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        // 文件操作
        'list_dir' => '查看目录',
        'read_files' => '批量读取文件',
        'write_file' => '写入文件',
        'edit_file' => '编辑文件',
        'multi_edit_file' => '批量编辑文件',
        'delete_files' => '删除文件',
        'file_search' => '搜索文件',
        'grep_search' => '内容搜索',

        // 搜索提取
        'web_search' => '网络搜索',
        'image_search' => '图片搜索',
        'read_webpages_as_markdown' => '网页转Markdown',
        'use_browser' => '浏览器操作',
        'download_from_urls' => '批量下载',
        'download_from_markdown' => '从Markdown下载',

        // 内容处理
        'visual_understanding' => '图片理解',
        'convert_to_markdown' => '转换为Markdown',
        'voice_understanding' => '语音识别',
        'summarize' => '内容摘要',
        'generate_image' => '智能图像生成',
        'create_slide' => '创建幻灯片',
        'create_slide_project' => '创建幻灯片项目',
        'create_dashboard_project' => '创建数据看板',
        'update_dashboard_template' => '更新看板模板',
        'backup_dashboard_template' => '备份看板模板',
        'finish_dashboard_task' => '完成看板配置',

        // 系统执行
        'shell_exec' => '执行命令',
        'run_python_snippet' => '执行Python',

        // AI协作
        'create_memory' => '创建记忆',
        'update_memory' => '更新记忆',
        'delete_memory' => '删除记忆',
        'finish_task' => '完成任务',
        'compact_chat_history' => '压缩聊天历史',
    ],

    'descriptions' => [
        // 文件操作
        'list_dir' => '查看目录内容工具，支持递归显示多层级目录结构，显示文件大小、行数和token数量，帮助快速了解项目文件组织和代码规模',
        'read_files' => '批量文件读取工具，一次性读取多个文件内容，支持文本、PDF、Word、Excel、CSV等多种格式，极大提升处理多文件任务的效率',
        'write_file' => '文件写入工具，将内容写入本地文件系统，支持创建新文件或覆盖现有文件，注意单次内容长度限制，大文件建议分步骤写入',
        'edit_file' => '文件精确编辑工具，对现有文件进行字符串替换操作，支持严格的匹配验证和替换次数控制，确保编辑操作的准确性',
        'multi_edit_file' => '多重文件编辑工具，在单个文件中执行多个查找替换操作，所有编辑按顺序应用，要么全部成功要么全部失败，保证操作原子性',
        'delete_files' => '删除多个文件工具，用于批量删除指定的文件或目录。删除前请确认所有文件路径正确，如果任何文件不存在将返回错误，只能删除工作目录中的文件，支持同时删除多个文件，提高操作效率',
        'file_search' => '文件路径搜索工具，基于文件路径的模糊匹配进行快速搜索，适用于已知部分文件路径但不确定具体位置的场景，最多返回10个结果',
        'grep_search' => '文件内容搜索工具，使用正则表达式在文件内容中搜索特定模式，支持文件类型过滤，显示匹配行及上下文，最多返回20个相关文件',

        // 搜索提取
        'web_search' => '互联网搜索工具，支持XML格式配置多个搜索需求并行处理，支持分页搜索和时间范围筛选，搜索结果包含标题、URL、摘要和来源网站',
        'image_search' => '图片搜索工具，根据关键词搜索并智能筛选高质量图片，支持视觉理解分析和长宽比筛选，自动去重确保图片质量',
        'read_webpages_as_markdown' => '批量网页读取工具，将多个网页内容聚合转换为单个Markdown文档，支持完整内容获取和摘要模式',
        'use_browser' => '浏览器自动化工具，提供原子化的浏览器操作能力，支持页面导航、元素交互、表单填写等模块化操作',
        'download_from_urls' => 'URL批量下载工具，支持XML配置多个下载任务，自动处理重定向，如果目标文件已存在将自动覆盖',
        'download_from_markdown' => 'Markdown文件批量下载工具，从Markdown文件中提取图片链接并批量下载，支持网络URL和本地文件复制',

        // 内容处理
        'visual_understanding' => '视觉理解工具，分析和解释图像内容，支持JPEG、PNG、GIF等多种格式，适用于图片识别描述、图表分析、文字提取、多图对比等场景',
        'convert_to_markdown' => '文档格式转换工具，将文档转换为Markdown格式并保存到指定位置。支持多种文件类型：PDF、Word、Excel、PowerPoint、图片、Jupyter笔记本等',
        'voice_understanding' => '语音识别工具，将音频文件转换为文本，支持wav、mp3、ogg、m4a等格式，可启用说话人信息识别功能',
        'summarize' => '信息精炼工具，提升文本信息密度，剔除冗余内容使其更结构化，支持自定义精炼要求和目标长度设置',
        'generate_image' => '图像生成与编辑工具，支持根据文字描述创建全新图像，也可以对已有图像进行修改编辑。可自定义图像尺寸、生成数量，并保存到指定位置，满足各种图像创作需求',
        'create_slide' => '幻灯片创建工具，生成HTML幻灯片并执行自定义JavaScript分析，支持布局检查和元素边界验证',
        'create_slide_project' => '幻灯片项目创建工具，自动创建完整项目结构，包含演示控制器、配置文件、资源文件夹和通信脚本',
        'create_dashboard_project' => '数据看板项目创建工具，从模板目录复制完整的数据看板框架，包含HTML、CSS、JavaScript和图表组件',
        'update_dashboard_template' => '看板模板更新工具，从模板目录同步dashboard.js、index.css、index.html和config.js文件到现有项目',
        'backup_dashboard_template' => '看板模板备份恢复工具，恢复指定项目的模板文件备份版本，实现当前文件和备份文件的互换',
        'finish_dashboard_task' => '看板项目完成工具，自动化完成地图和数据源配置，包括GeoJSON下载、HTML配置更新和数据文件扫描',

        // 系统执行
        'shell_exec' => 'Shell命令执行工具，执行系统命令和脚本，支持超时设置和工作目录指定，适用于文件操作、进程管理等系统管理场景',
        'run_python_snippet' => 'Python代码片段执行工具，适用于数据分析、处理、转换、快速计算、验证及文件操作和处理等场景。适用于中小型Python代码片段（<=200行），复杂脚本应持久化到文件后再使用shell_exec工具执行',

        // AI协作
        'create_memory' => '长期记忆创建工具，存储用户偏好、项目信息等重要记忆，支持用户和项目两种记忆类型，可设置是否需要用户确认',
        'update_memory' => '长期记忆更新工具，修改已存在的记忆内容或标签信息，通过记忆ID定位并更新指定记忆',
        'delete_memory' => '长期记忆删除工具，通过记忆ID彻底移除不需要的记忆信息，用于清理过时或错误的记忆数据',
        'finish_task' => '任务完成工具，在完成所有必需任务时调用，提供最终回复或暂停任务向用户反馈，调用后将进入停止状态',
        'compact_chat_history' => '聊天历史压缩工具，当对话变得过长时用于压缩和优化聊天历史记录，通过分析对话过程并生成摘要来减少上下文长度，提升后续对话效率',
    ],
];
