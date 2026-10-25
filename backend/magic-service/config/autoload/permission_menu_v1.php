<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fallback_legacy_tree' => false,
    'resource_menu_mapping' => [
        // 非官方组织：AI 管理
        'workspace.model.text' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'text_model', 'label' => '文本大模型及服务商', 'order' => 1],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.model.image' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'image_model', 'label' => '生图大模型及服务商', 'order' => 2],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.model.video' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'video_model', 'label' => '视频大模型及服务商', 'order' => 3],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.model_audit_log' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'model_audit_log', 'label' => '模型审计日志', 'order' => 4],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.model_audit_statistics' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'data_dashboard', 'label' => '数据看板', 'order' => 4],
                ['key' => 'model_monitoring', 'label' => '大模型日志监控', 'order' => 1],
            ],
            'tag' => '数据看板',
        ],
        'workspace.ai.agent_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'internal_employee_skill', 'label' => '内部员工及技能', 'order' => 5],
                ['key' => 'employee_review', 'label' => '员工发布审核', 'order' => 1],
            ],
            'tag' => '内部员工及技能',
        ],
        'workspace.ai.skill_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'internal_employee_skill', 'label' => '内部员工及技能', 'order' => 5],
                ['key' => 'skill_review', 'label' => '技能发布审核', 'order' => 2],
            ],
            'tag' => '内部员工及技能',
        ],
        'admin.ai.model_access_role' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 2],
                ['key' => 'model_access', 'label' => '模型管控', 'order' => 1],
            ],
            'tag' => '模型管理',
        ],
        'admin.ai.application.menu' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'application_config', 'label' => '应用配置', 'order' => 6],
                ['key' => 'application_menu', 'label' => '应用菜单', 'order' => 1],
            ],
            'tag' => '应用配置',
        ],

        // 非官方组织：企业功能
        'admin.safe.admin' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'security_permission', 'label' => '安全与权限', 'order' => 1],
                ['key' => 'admin', 'label' => '管理员权限', 'order' => 1],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.sub_admin' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'security_permission', 'label' => '安全与权限', 'order' => 1],
                ['key' => 'sub_admin', 'label' => '子管理员', 'order' => 2],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.operation_log' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'security_permission', 'label' => '安全与权限', 'order' => 1],
                ['key' => 'operation_log', 'label' => '管理员日志', 'order' => 3],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.function_permission' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'security_permission', 'label' => '安全与权限', 'order' => 1],
                ['key' => 'function_permission', 'label' => '功能权限', 'order' => 4],
            ],
            'tag' => '安全与权限',
        ],
        'admin.setting.identity_watermark' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'organization_settings', 'label' => '组织设置', 'order' => 5],
                ['key' => 'identity_watermark', 'label' => '页面身份水印', 'order' => 1],
            ],
            'tag' => '组织设置',
        ],

        // 官方组织：平台管理
        'platform.ai.model_multiplier' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 2],
                ['key' => 'model_multiplier', 'label' => '模型倍率', 'order' => 4],
            ],
            'tag' => '模型管理',
        ],
        'platform.model.text' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_model', 'label' => '平台模型', 'order' => 2],
                ['key' => 'text_model', 'label' => '文本大模型及服务商', 'order' => 1],
            ],
            'tag' => '平台模型',
        ],
        'platform.model.image' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_model', 'label' => '平台模型', 'order' => 2],
                ['key' => 'image_model', 'label' => '生图大模型及服务商', 'order' => 2],
            ],
            'tag' => '平台模型',
        ],
        'platform.model.video' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_model', 'label' => '平台模型', 'order' => 2],
                ['key' => 'video_model', 'label' => '视频大模型及服务商', 'order' => 3],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.model_audit_log' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_model', 'label' => '平台模型', 'order' => 2],
                ['key' => 'model_audit_log', 'label' => '模型审计日志', 'order' => 4],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.model_audit_statistics' => [
            'path' => [
                ['key' => 'ai_management', 'label' => 'AI 管理', 'order' => 2],
                ['key' => 'data_dashboard', 'label' => '数据看板', 'order' => 4],
                ['key' => 'model_monitoring', 'label' => '大模型日志监控', 'order' => 1],
            ],
            'tag' => '数据看板',
        ],
        'platform.ai.ability' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'system_capability', 'label' => '能力管理', 'order' => 1],
            ],
            'tag' => '智能体增强',
        ],
        'platform.setting.slides_template' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'slides_template', 'label' => 'PPT 模板', 'order' => 2],
            ],
            'tag' => '智能体增强',
        ],
        'platform.setting.asset' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'asset_library', 'label' => '素材库', 'order' => 3],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.official' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'official_agent', 'label' => '官方内置员工', 'order' => 3],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.review' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'employee_review', 'label' => '员工审核', 'order' => 6],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.market' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'employee_market', 'label' => '员工市场', 'order' => 7],
            ],
            'tag' => '智能体增强',
        ],
        'platform.skill.review' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'skill_review', 'label' => 'Skill 审核', 'order' => 4],
            ],
            'tag' => '智能体增强',
        ],
        'platform.skill.market' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_enhancement', 'label' => '智能体增强', 'order' => 3],
                ['key' => 'skill_market', 'label' => 'Skill 市场', 'order' => 5],
            ],
            'tag' => '智能体增强',
        ],
        'platform.organization.list' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_tenant', 'label' => '平台租户', 'order' => 4],
                ['key' => 'tenant_list', 'label' => '租户管理', 'order' => 1],
            ],
            'tag' => '平台租户',
        ],
        'platform.setting.platform_info' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_settings', 'label' => '平台管理', 'order' => 5],
                ['key' => 'platform_info', 'label' => '平台信息', 'order' => 1],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.application' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_settings', 'label' => '平台管理', 'order' => 5],
                ['key' => 'application_menu', 'label' => '应用菜单', 'order' => 2],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.maintenance' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'platform_settings', 'label' => '平台管理', 'order' => 5],
                ['key' => 'platform_maintenance', 'label' => '平台维护', 'order' => 3],
            ],
            'tag' => '平台管理',
        ],
    ],
    'official_organization_hidden_resource_keys' => [
        'workspace.model.text',
        'workspace.model.image',
        'workspace.model.video',
        'admin.ai.application.menu',
        'admin.setting.identity_watermark',
        'workspace.ai.model_audit_log',
        'workspace.ai.model_audit_statistics',
    ],
];
