<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\ExpireType;
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\PackageType;
use Dtyq\BillingManager\Infrastructure\Core\Constants\BillManager\QuotaType;

/*
 * 套餐配额设置的 demo，具体值保存在商品的规格中。
 *
 * 规则的基本结构和类型定义请参见 magic_package_rule_groups.php
 */
return [
    PackageType::PERSONAL_FREE->value => [
        // 发放积分数量
        QuotaType::ORGANIZATION_MAGIC_POINT->value => [
            'amount' => 300,
            'crontab' => '0 0 1 * *',
            'expire_type' => ExpireType::DAY_VALID->value,
        ],
        // 团队人数上限
        QuotaType::ORGANIZATION_MEMBER_COUNT_LIMIT->value => [
            'amount' => 50,
        ],
        // 超级麦吉工作区数量上限
        QuotaType::SUPER_MAGIC_PERSON_WORKSPACE_CREATED_COUNT_LIMIT->value => [
            'amount' => 3,
        ],
        // 超级麦吉话题数量上限
        QuotaType::SUPER_MAGIC_PERSON_TOPIC_CREATED_COUNT_LIMIT->value => [
            'amount' => 10,
        ],
        // 超级麦吉话题回放分享数量上限
        QuotaType::SUPER_MAGIC_PERSON_SHARE_REPLAY_COUNT_LIMIT->value => [
            'amount' => 5,
        ],
        // 超级麦吉生成的网站数量上限
        QuotaType::SUPER_MAGIC_PERSON_WEBSITE_CREATED_COUNT_LIMIT->value => [
            'amount' => 1,
        ],
        // 超级麦吉单人的任务最大同时运行数量
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_RUNNING_COUNT_LIMIT->value => [
            'amount' => 3,
        ],
        // 超级麦吉单个任务最高执行轮次
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_ROUND_LIMIT->value => [
            'amount' => 10,
        ],
        // 超级麦吉单个任务单轮消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_TOKEN_LIMIT->value => [
            'amount' => 2000,
        ],
        // 超级麦吉单个任务总消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_TOTAL_TOKEN_LIMIT->value => [
            'amount' => 10000,
        ],
        // 组织拥有 agent 数量上限
        QuotaType::ORGANIZATION_AGENT_COUNT->value => [
            'amount' => 3,
        ],
    ],
    PackageType::PERSONAL_PRO->value => [
        // 发放积分数量
        QuotaType::ORGANIZATION_MAGIC_POINT->value => [
            'amount' => 30000,
            'crontab' => '0 0 * * *',
        ],
        // 团队人数上限
        QuotaType::ORGANIZATION_MEMBER_COUNT_LIMIT->value => [
            'amount' => 100,
        ],
        // 超级麦吉工作区数量上限
        QuotaType::SUPER_MAGIC_PERSON_WORKSPACE_CREATED_COUNT_LIMIT->value => [
            'amount' => 10,
        ],
        // 超级麦吉话题数量上限
        QuotaType::SUPER_MAGIC_PERSON_TOPIC_CREATED_COUNT_LIMIT->value => [
            'amount' => 50,
        ],
        // 超级麦吉话题回放分享数量上限
        QuotaType::SUPER_MAGIC_PERSON_SHARE_REPLAY_COUNT_LIMIT->value => [
            'amount' => 20,
        ],
        // 超级麦吉生成的网站数量上限
        QuotaType::SUPER_MAGIC_PERSON_WEBSITE_CREATED_COUNT_LIMIT->value => [
            'amount' => 5,
        ],
        // 超级麦吉单人的任务最大同时运行数量
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_RUNNING_COUNT_LIMIT->value => [
            'amount' => 5,
        ],
        // 超级麦吉单个任务最高执行轮次
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_ROUND_LIMIT->value => [
            'amount' => 20,
        ],
        // 超级麦吉单个任务单轮消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_TOKEN_LIMIT->value => [
            'amount' => 4000,
        ],
        // 超级麦吉单个任务总消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_TOTAL_TOKEN_LIMIT->value => [
            'amount' => 30000,
        ],
        // 组织拥有 agent 数量上限
        QuotaType::ORGANIZATION_AGENT_COUNT->value => [
            'amount' => 10,
        ],
    ],
    PackageType::ENTERPRISE->value => [
        // 发放积分数量
        QuotaType::ORGANIZATION_MAGIC_POINT->value => [
            'amount' => 510000,
        ],
        // 团队人数上限
        QuotaType::ORGANIZATION_MEMBER_COUNT_LIMIT->value => [
            'amount' => 500,
        ],
        // 超级麦吉工作区数量上限
        QuotaType::SUPER_MAGIC_PERSON_WORKSPACE_CREATED_COUNT_LIMIT->value => [
            'amount' => 100,
        ],
        // 超级麦吉话题数量上限
        QuotaType::SUPER_MAGIC_PERSON_TOPIC_CREATED_COUNT_LIMIT->value => [
            'amount' => 200,
        ],
        // 超级麦吉话题回放分享数量上限
        QuotaType::SUPER_MAGIC_PERSON_SHARE_REPLAY_COUNT_LIMIT->value => [
            'amount' => 100,
        ],
        // 超级麦吉生成的网站数量上限
        QuotaType::SUPER_MAGIC_PERSON_WEBSITE_CREATED_COUNT_LIMIT->value => [
            'amount' => 30,
        ],
        // 超级麦吉单人的任务最大同时运行数量
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_RUNNING_COUNT_LIMIT->value => [
            'amount' => 10,
        ],
        // 超级麦吉单个任务最高执行轮次
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_ROUND_LIMIT->value => [
            'amount' => 50,
        ],
        // 超级麦吉单个任务单轮消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_EXECUTION_TOKEN_LIMIT->value => [
            'amount' => 8000,
        ],
        // 超级麦吉单个任务总消耗 token 上限
        QuotaType::SUPER_MAGIC_PERSON_TASK_MAX_TOTAL_TOKEN_LIMIT->value => [
            'amount' => 100000,
        ],
        // 组织拥有 agent 数量上限
        QuotaType::ORGANIZATION_AGENT_COUNT->value => [
            'amount' => 30,
        ],
    ],
];
