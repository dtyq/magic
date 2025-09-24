<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 投递
    'delivery_failed' => '事件投递失败',
    'publisher_not_found' => '事件发布器未找到',
    'exchange_not_found' => '事件交换机未找到',
    'routing_key_invalid' => '事件路由键无效',

    // 消费
    'consumer_execution_failed' => '事件消费执行失败',
    'consumer_not_found' => '事件消费者未找到',
    'consumer_timeout' => '事件消费超时',
    'consumer_retry_exceeded' => '事件消费重试次数超限',
    'consumer_validation_failed' => '事件消费参数校验失败',

    // 数据
    'data_serialization_failed' => '事件数据序列化失败',
    'data_deserialization_failed' => '事件数据反序列化失败',
    'data_validation_failed' => '事件数据校验失败',
    'data_format_invalid' => '事件数据格式无效',

    // 队列
    'queue_connection_failed' => '事件队列连接失败',
    'queue_not_found' => '事件队列未找到',
    'queue_full' => '事件队列已满',
    'queue_permission_denied' => '事件队列无权限',

    // 处理
    'processing_interrupted' => '事件处理被中断',
    'processing_deadlock' => '事件处理发生死锁',
    'processing_resource_exhausted' => '事件处理资源耗尽',
    'processing_dependency_failed' => '事件处理依赖失败',

    // 配置
    'configuration_invalid' => '事件配置无效',
    'handler_not_registered' => '事件处理器未注册',
    'listener_registration_failed' => '事件监听器注册失败',

    // 系统
    'system_unavailable' => '事件系统不可用',
    'system_overloaded' => '事件系统过载',
    'system_maintenance' => '事件系统维护中',

    // 业务
    'points' => [
        'insufficient' => '积分不足',
    ],
    'task' => [
        'pending' => '任务待处理',
        'stop' => '任务已停止',
    ],
    'credit' => [
        'insufficient_limit' => '信用额度不足',
    ],
];
