<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'not_found' => '任务未找到',
    'work_dir_not_found' => '工作目录未找到',
    'continue' => '继续',
    'initialize_error' => '当前系统繁忙，请稍后重试。',
    'agent_stopped' => '任务已终止',
    'finished_task_action' => '已完成结果文件的输出',
    'access_token_not_found' => '访问令牌未找到',
    'disable_web_search_constraint' => <<<'TEXT'
【重要约束】针对本轮用户消息，请严格遵循以下要求：

1. 禁止使用 web_search 工具进行互联网搜索

2. 仅使用以下工具检索信息：
   - list_dir：查看工作区目录结构
   - file_search：搜索文件名
   - grep_search：搜索文件内容
   - read_files：读取文件内容

3. 如果本地找不到相关信息，直接告知用户"在工作区中未找到相关信息"

4. 基于工作区现有文件和之前对话内容回答问题

重要说明：此约束仅适用于本轮用户消息。如果下一轮用户消息中没有明确提示禁用 web_search 工具，则照常处理，可以直接使用 web_search 工具进行互联网搜索，无需额外确认。
TEXT,
];
