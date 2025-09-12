<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'resource' => [
        'admin' => '管理后台',
        'admin_ai' => 'AI管理',
        'admin_safe' => '安全与权限',
        'safe_sub_admin' => '子管理员',
        'ai_model' => '大模型',
        'ai_image' => '智能绘图',
        'ai_mode' => '模式',
        'ai_content_audit' => 'AI内容审核',
        'console' => '控制台',
        'api' => '接口',
        'api_assistant' => '接口助手',
        'platform' => '平台管理',
        'platform_setting' => '系统设置',
        'platform_setting_maintenance' => '维护管理',
    ],
    'operation' => [
        'query' => '查询',
        'edit' => '编辑',
    ],
    'error' => [
        'role_name_exists' => '角色名称 :name 已存在',
        'role_not_found' => '角色不存在',
        'invalid_permission_key' => '权限键 :key 无效',
        'access_denied' => '无权限访问',
        'user_already_organization_admin' => '用户 :userId 已经是组织管理员',
        'organization_admin_not_found' => '组织管理员不存在',
        'organization_creator_cannot_be_revoked' => '组织创建人不可撤销',
        'organization_creator_cannot_be_disabled' => '组织创建人不可禁用',
        'current_user_not_organization_creator' => '当前用户不是组织创建人',
        'personal_organization_cannot_grant_admin' => '个人组织不可设置组织管理员',
    ],
];
