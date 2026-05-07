<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 是否允许在未命中映射时回退旧版树结构（默认关闭，避免新旧树混出）。
    'fallback_legacy_tree' => false,

    /*
     * 菜单映射配置（仅影响权限树展示与 permission_tag，不影响接口鉴权）。
     *
     * 说明：
     * - key: 资源 resource（MagicResourceEnum::value）
     * - path: 新菜单路径（从一级到三级）
     * - tag: 该资源用于角色列表展示的 permission_tag（通常取二级菜单）
     */
    'resource_menu_mapping' => [
        'platform.ai.model_management' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_model', 'label' => '平台模型'],
                ['key' => 'text_model', 'label' => '文本大模型'],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.image_generation' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_model', 'label' => '平台模型'],
                ['key' => 'image_model', 'label' => '生图大模型'],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.model_audit_log' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_model', 'label' => '平台模型'],
                ['key' => 'model_audit_log', 'label' => '模型调用审计'],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.mode_management' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                ['key' => 'system_agent', 'label' => '系统智能体'],
            ],
            'tag' => '智能体增强',
        ],
        'platform.ai.ability' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                ['key' => 'system_skill', 'label' => '系统技能'],
            ],
            'tag' => '智能体增强',
        ],
        'platform.ai.skill_management' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                ['key' => 'system_skill', 'label' => '系统技能'],
            ],
            'tag' => '智能体增强',
        ],
        'platform.ai.agent_management' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                ['key' => 'system_agent', 'label' => '系统智能体'],
            ],
            'tag' => '智能体增强',
        ],
        'platform.organization.list' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_tenant', 'label' => '平台租户'],
                ['key' => 'tenant_management', 'label' => '租户管理'],
            ],
            'tag' => '平台租户',
        ],
        'platform.organization.user_list' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_tenant', 'label' => '平台租户'],
                ['key' => 'platform_user', 'label' => '平台用户'],
            ],
            'tag' => '平台租户',
        ],
        'platform.setting.platform_info' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_console_management', 'label' => '平台管理'],
                ['key' => 'platform_info', 'label' => '平台信息'],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.maintenance' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理'],
                ['key' => 'platform_console_management', 'label' => '平台管理'],
                ['key' => 'platform_maintenance', 'label' => '平台维护'],
            ],
            'tag' => '平台管理',
        ],
        'admin.safe.sub_admin' => [
            'path' => [
                ['key' => 'enterprise_feature', 'label' => '企业功能'],
                ['key' => 'security_and_permission', 'label' => '安全与权限'],
                ['key' => 'admin_permission', 'label' => '管理员权限'],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.admin' => [
            'path' => [
                ['key' => 'enterprise_feature', 'label' => '企业功能'],
                ['key' => 'security_and_permission', 'label' => '安全与权限'],
                ['key' => 'admin_permission', 'label' => '管理员权限'],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.operation_log' => [
            'path' => [
                ['key' => 'enterprise_feature', 'label' => '企业功能'],
                ['key' => 'security_and_permission', 'label' => '安全与权限'],
                ['key' => 'admin_log', 'label' => '管理员日志'],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.function_permission' => [
            'path' => [
                ['key' => 'enterprise_feature', 'label' => '企业功能'],
                ['key' => 'security_and_permission', 'label' => '安全与权限'],
                ['key' => 'function_permission', 'label' => '功能权限'],
            ],
            'tag' => '安全与权限',
        ],
        'admin.ai.model_access_role' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI管理'],
                ['key' => 'custom_model', 'label' => '自定义大模型'],
                ['key' => 'model_access_role', 'label' => '模型访问权限'],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.model_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理'],
                ['key' => 'custom_model', 'label' => '自定义大模型'],
                ['key' => 'text_model', 'label' => '文本大模型'],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.image_generation' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理'],
                ['key' => 'custom_model', 'label' => '自定义大模型'],
                ['key' => 'image_model', 'label' => '生图大模型'],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.model_audit_log' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理'],
                ['key' => 'custom_model', 'label' => '自定义大模型'],
                ['key' => 'model_audit_log', 'label' => '模型调用审计'],
            ],
            'tag' => '自定义大模型',
        ],
    ],

    /*
     * 菜单别名映射（仅影响权限树展示，不影响 permission_tag 与接口鉴权）。
     *
     * 用途：
     * - 当前产品存在“多个菜单入口复用同一组权限资源”的场景
     * - 例如视频大模型、Skill 审核/市场、员工审核/市场
     * - 主路径仍由 resource_menu_mapping 决定，这里只追加别名菜单节点
     */
    'resource_menu_alias_mapping' => [
        'platform.ai.model_management' => [
            [
                'path' => [
                    ['key' => 'platform_management', 'label' => '平台管理'],
                    ['key' => 'platform_model', 'label' => '平台模型'],
                    ['key' => 'video_model', 'label' => '视频大模型'],
                ],
            ],
        ],
        'platform.ai.skill_management' => [
            [
                'path' => [
                    ['key' => 'platform_management', 'label' => '平台管理'],
                    ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                    ['key' => 'skill_review', 'label' => 'Skill 审核'],
                ],
            ],
            [
                'path' => [
                    ['key' => 'platform_management', 'label' => '平台管理'],
                    ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                    ['key' => 'skill_market', 'label' => 'Skill 市场'],
                ],
            ],
        ],
        'platform.ai.agent_management' => [
            [
                'path' => [
                    ['key' => 'platform_management', 'label' => '平台管理'],
                    ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                    ['key' => 'employee_review', 'label' => '员工审核'],
                ],
            ],
            [
                'path' => [
                    ['key' => 'platform_management', 'label' => '平台管理'],
                    ['key' => 'agent_enhancement', 'label' => '智能体增强'],
                    ['key' => 'employee_market', 'label' => '员工市场'],
                ],
            ],
        ],
    ],
];
