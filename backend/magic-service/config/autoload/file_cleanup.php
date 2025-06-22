<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 默认过期时间(秒) - 2小时
    'default_expire_seconds' => 7200,

    // 定时任务配置
    'crontab' => [
        'batch_size' => 50,           // 每批处理文件数量
        'retry_batch_size' => 30,     // 重试记录每批处理数量
        'max_batches' => 20,          // 最多处理批次数
        'max_retry_batches' => 10,    // 最多重试批次数
    ],

    // 重试配置
    'retry' => [
        'max_retries' => 3,           // 最大重试次数
        'retry_delay' => 300,         // 重试间隔(秒) - 5分钟
    ],

    // 维护配置
    'maintenance' => [
        'success_days_to_keep' => 7,  // 成功记录保留天数
        'failed_days_to_keep' => 7,   // 失败记录保留天数
        'enable_auto_maintenance' => true, // 是否启用自动维护
    ],

    // 监控配置
    'monitoring' => [
        'enable_detailed_logs' => true,     // 是否启用详细日志
        'warn_failed_threshold' => 100,     // 失败记录告警阈值
        'warn_pending_threshold' => 500,    // 待处理记录告警阈值
    ],

    // 不同来源类型的默认配置
    'source_types' => [
        'batch_compress' => [
            'expire_seconds' => 7200,        // 2小时
            'description' => '批量压缩文件',
        ],
        'temp_upload' => [
            'expire_seconds' => 3600,        // 1小时
            'description' => '临时上传文件',
        ],
        'ai_generated' => [
            'expire_seconds' => 86400,       // 24小时
            'description' => 'AI生成文件',
        ],
        'preview_cache' => [
            'expire_seconds' => 1800,        // 30分钟
            'description' => '预览缓存文件',
        ],
    ],
];
