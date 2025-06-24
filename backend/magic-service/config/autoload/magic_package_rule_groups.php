<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\BillingTargetType;
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\Operation;
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\PackageType;
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\QuotaType;

/*
 * 套餐配置信息
 * 包含套餐名称列表、各套餐的优先级配置和基础规则列表
 *
 * 注意：此文件只定义规则的结构和类型，规则的具体配额值请查看 magic_package_quota.php 配置
 */

// 套餐优先级 (值越大优先级越高)
$packagePriorities = [
    PackageType::ENTERPRISE->value => 3,      // 企业版优先级最高
    PackageType::PERSONAL_PRO->value => 2,    // 个人专业版次之
    PackageType::PERSONAL_FREE->value => 1,   // 个人免费版优先级最低
];

/*
 * 套餐配置
 * - packages: 支持的套餐名称列表
 * - priorities: 各套餐的优先级配置 (值越大优先级越高)
 * - base_rules: 基础规则列表（所有套餐共用）
 *
 * 重要：各规则的具体配额值请查看 magic_package_quota.php 配置文件
 */
return [
    // 可用套餐列表
    'packages' => array_keys($packagePriorities),

    // 套餐优先级配置
    'priorities' => $packagePriorities,

    // 基础规则列表（所有套餐共用）
    // 注意：此处只定义规则结构，具体配额值请查看 magic_package_quota.php
    'base_rules' => [
        [
            'name' => QuotaType::ORGANIZATION_MAGIC_POINT->value,
            'limit' => false,
            'description' => '发放积分',
            'quota_type' => QuotaType::ORGANIZATION_MAGIC_POINT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::ORGANIZATION->value,
            'crontab' => '0 0 1 * *', // 每月1日
            'conditions' => [],
            'operation' => Operation::ADD->value,
        ],
        [
            'name' => QuotaType::ORGANIZATION_MEMBER_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '团队人数上限',
            'quota_type' => QuotaType::ORGANIZATION_MEMBER_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::ORGANIZATION->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_WORKSPACE_CREATED_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉工作区数量上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_WORKSPACE_CREATED_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::USER->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_TOPIC_CREATED_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉话题数量上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_TOPIC_CREATED_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::USER->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_SHARE_REPLAY_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉话题回放分享数量上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_SHARE_REPLAY_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::USER->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_WEBSITE_CREATED_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉生成的网站数量上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_WEBSITE_CREATED_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::USER->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_RUNNING_COUNT_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉单人的任务最大同时运行数量',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_RUNNING_COUNT_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::USER->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_ROUND_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉单个任务最高执行轮次',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_ROUND_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::TASK->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_TOKEN_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉单个任务单轮消耗 token 上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_TOKEN_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::TASK->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_TOTAL_TOKEN_LIMIT->value,
            'limit' => false,
            'description' => '超级麦吉单个任务总消耗 token 上限',
            'quota_type' => QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_TOTAL_TOKEN_LIMIT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::TASK->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
        [
            'name' => QuotaType::ORGANIZATION_AGENT_COUNT->value,
            'limit' => false,
            'description' => '组织拥有 agent 数量上限',
            'quota_type' => QuotaType::ORGANIZATION_AGENT_COUNT->value,
            'is_active' => true,
            'applies_to' => BillingTargetType::ORGANIZATION->value,
            'crontab' => '',
            'conditions' => [],
            'operation' => Operation::SET->value,
        ],
    ],
];
