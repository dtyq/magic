<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'volcengine' => [
        'invalid_response_format' => '火山引擎响应格式无效',
        'submit_failed' => '调用火山引擎API提交任务失败',
        'submit_exception' => '调用火山引擎提交任务时发生异常',
        'query_failed' => '调用火山引擎API查询结果失败',
        'query_exception' => '调用火山引擎查询结果时发生异常',
        'config_incomplete' => '火山引擎配置不完整，缺少 app_id、token 或 cluster',
        'task_id_required' => '任务ID不能为空',
        'bigmodel' => [
            'invalid_response_format' => '大模型ASR响应格式无效',
            'submit_exception' => '调用大模型ASR提交任务时发生异常',
            'query_exception' => '调用大模型ASR查询结果时发生异常',
        ],
    ],
];
