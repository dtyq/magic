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
<constraint>
【临时约束 - 仅本条消息有效】

本条消息的约束：
1. 禁止使用 web_search 工具
2. 仅使用 list_dir、file_search、grep_search、read_files 检索信息
3. 找不到信息时，告知"在工作区中未找到相关信息"

约束失效规则：
- 回复完成后，约束立即失效
- 下一条消息中，如果用户没有再次说明相同约束，则约束已解除
- 约束解除后，恢复正常行为，直接使用所有工具（包括 web_search），不要说"环境限制"或提及之前的约束
</constraint>
TEXT,
];
