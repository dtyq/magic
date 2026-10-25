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
        'platform.model.text' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 6],
                ['key' => 'text_model', 'label' => '文本大模型及服务商', 'order' => 1],
            ],
            'tag' => '平台模型',
        ],
        'platform.model.image' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 6],
                ['key' => 'image_model', 'label' => '生图大模型及服务商', 'order' => 2],
            ],
            'tag' => '平台模型',
        ],
        'platform.model.video' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 6],
                ['key' => 'video_model', 'label' => '视频大模型及服务商', 'order' => 3],
            ],
            'tag' => '平台模型',
        ],
        'platform.ai.model_multiplier' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 6],
                ['key' => 'model_multiplier', 'label' => '模型倍率', 'order' => 3],
            ],
            'tag' => '模型管理',
        ],
        'platform.ai.model_management' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'model_management', 'label' => '模型管理', 'order' => 6],
                ['key' => 'model_provider_list', 'label' => '模型及服务商列表', 'order' => 1],
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
        'platform.ai.model_audit_statistics' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'logs_analytics', 'label' => '日志及分析', 'order' => 2],
                ['key' => 'model_monitoring', 'label' => '大模型监控', 'order' => 1],
            ],
            'tag' => '日志及分析',
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
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'system_skill', 'label' => '系统能力', 'order' => 1],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.official' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'official_agent', 'label' => '官方员工', 'order' => 2],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.review' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'publish_review', 'label' => '发布审核', 'order' => 4],
                ['key' => 'employee_review', 'label' => '员工审核', 'order' => 1],
            ],
            'tag' => '智能体增强',
        ],
        'platform.agent.market' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'official_market', 'label' => '官方市场', 'order' => 3],
                ['key' => 'employee_market', 'label' => '员工市场', 'order' => 1],
            ],
            'tag' => '智能体增强',
        ],
        'platform.skill.review' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'publish_review', 'label' => '发布审核', 'order' => 4],
                ['key' => 'skill_review', 'label' => 'Skill 审核', 'order' => 2],
            ],
            'tag' => '智能体增强',
        ],
        'platform.skill.market' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'official_market', 'label' => '官方市场', 'order' => 3],
                ['key' => 'skill_market', 'label' => 'Skill 市场', 'order' => 2],
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
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'tenant_management', 'label' => '租户管理', 'order' => 4],
                ['key' => 'tenant_list', 'label' => '租户列表', 'order' => 1],
            ],
            'tag' => '平台租户',
        ],
        'platform.organization.user_list' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'tenant_management', 'label' => '租户管理', 'order' => 4],
                ['key' => 'platform_user', 'label' => '平台用户', 'order' => 2],
            ],
            'tag' => '平台租户',
        ],
        'platform.setting.platform_info' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'basic_settings', 'label' => '基础设置', 'order' => 1],
                ['key' => 'platform_info', 'label' => '平台信息', 'order' => 1],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.maintenance' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'operations_settings', 'label' => '运营设置', 'order' => 2],
                ['key' => 'platform_maintenance', 'label' => '平台维护', 'order' => 3],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.application' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'basic_settings', 'label' => '基础设置', 'order' => 1],
                ['key' => 'application_menu', 'label' => '应用菜单', 'order' => 2],
            ],
            'tag' => '平台管理',
        ],
        'platform.setting.slides_template' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'slides_template', 'label' => 'PPT 模板', 'order' => 5],
            ],
            'tag' => '智能体增强',
        ],
        'platform.setting.asset' => [
            'path' => [
                ['key' => 'platform_management', 'label' => '平台管理', 'order' => 1],
                ['key' => 'agent_management', 'label' => '智能体管理', 'order' => 5],
                ['key' => 'asset_library', 'label' => '素材库', 'order' => 6],
            ],
            'tag' => '智能体增强',
        ],
        'admin.safe.sub_admin' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'security_permissions', 'label' => '管理权限', 'order' => 3],
                ['key' => 'sub_admin', 'label' => '子管理员', 'order' => 2],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.admin' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'security_permissions', 'label' => '管理权限', 'order' => 3],
                ['key' => 'admin', 'label' => '企业管理员', 'order' => 1],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.operation_log' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'logs_analytics', 'label' => '日志及分析', 'order' => 2],
                ['key' => 'operation_log', 'label' => '后台操作日志', 'order' => 3],
            ],
            'tag' => '安全与权限',
        ],
        'admin.safe.function_permission' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'governance_policies', 'label' => '管控策略', 'order' => 2],
                ['key' => 'function_permission', 'label' => 'AI 权限设置', 'order' => 3],
            ],
            'tag' => '安全与权限',
        ],
        'admin.ai.model_access_role' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'governance_policies', 'label' => '管控策略', 'order' => 2],
                ['key' => 'model_access_role', 'label' => '大模型管控', 'order' => 1],
            ],
            'tag' => '自定义大模型',
        ],
        'admin.ai.application.menu' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'application_management', 'label' => '应用管理', 'order' => 4],
                ['key' => 'organization_app_menu', 'label' => '组织应用菜单', 'order' => 1],
            ],
            'tag' => '应用菜单',
        ],
        'admin.setting.identity_watermark' => [
            'path' => [
                ['key' => 'enterprise_function', 'label' => '企业功能', 'order' => 3],
                ['key' => 'organization_settings', 'label' => '组织设置', 'order' => 5],
                ['key' => 'identity_watermark', 'label' => '页面身份水印', 'order' => 1],
            ],
            'tag' => '组织设置',
        ],
        'workspace.model.text' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'text_model', 'label' => '文本大模型及服务商', 'order' => 1],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.model.image' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'image_model', 'label' => '生图大模型及服务商', 'order' => 2],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.model.video' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'video_model', 'label' => '视频大模型及服务商', 'order' => 3],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.agent_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'internal_employee_and_skill', 'label' => '发布与审核', 'order' => 3],
                ['key' => 'internal_publish_review', 'label' => '内部发布审核', 'order' => 1],
                ['key' => 'agent', 'label' => '员工审核', 'order' => 1],
            ],
            'tag' => '内部员工及技能',
        ],
        'workspace.ai.skill_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'internal_employee_and_skill', 'label' => '发布与审核', 'order' => 3],
                ['key' => 'internal_publish_review', 'label' => '内部发布审核', 'order' => 1],
                ['key' => 'skill', 'label' => 'Skill 审核', 'order' => 2],
            ],
            'tag' => '内部员工及技能',
        ],
        'workspace.ai.model_management' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理', 'order' => 2],
                ['key' => 'custom_model', 'label' => '自定义大模型', 'order' => 1],
                ['key' => 'model_provider_list', 'label' => '模型及服务商列表', 'order' => 1],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.image_generation' => [
            'path' => [
                ['key' => 'ai_management', 'label' => '企业 AI 管理'],
                ['key' => 'custom_model', 'label' => '自定义大模型'],
                ['key' => 'image_model', 'label' => '生图大模型'],
            ],
            'tag' => '自定义大模型',
        ],
        'workspace.ai.model_audit_log' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'logs_analytics', 'label' => '日志及分析', 'order' => 2],
                ['key' => 'model_audit', 'label' => '大模型审计', 'order' => 2],
            ],
            'tag' => '日志及分析',
        ],
        'workspace.ai.model_audit_statistics' => [
            'path' => [
                ['key' => 'data_security', 'label' => '数据与安全', 'order' => 3],
                ['key' => 'logs_analytics', 'label' => '日志及分析', 'order' => 2],
                ['key' => 'model_monitoring', 'label' => '大模型监控', 'order' => 1],
            ],
            'tag' => '日志及分析',
        ],
    ],

    /*
     * 资源兼容映射。
     *
     * 用途：
     * - 第二阶段引入新资源 key 后，允许运行时继续兼容历史角色中仍未迁移的旧权限键
     * - key: 新资源
     * - value: 可兼容命中的旧资源列表
     */
    'resource_compatibility_mapping' => [
        'platform.model' => ['platform.ai.model_management'],
        'platform.model.text' => ['platform.ai.model_management'],
        'platform.model.image' => ['platform.ai.image_generation', 'platform.ai.model_management'],
        'platform.model.video' => ['platform.ai.model_management'],
        'workspace.model' => ['workspace.ai.model_management'],
        'workspace.model.text' => ['workspace.ai.model_management'],
        'workspace.model.image' => ['workspace.ai.image_generation', 'workspace.ai.model_management'],
        'workspace.model.video' => ['workspace.ai.model_management'],
        'platform.agent.official' => ['platform.ai.agent_management'],
        'platform.agent.review' => ['platform.ai.agent_management'],
        'platform.agent.market' => ['platform.ai.agent_management'],
        'platform.skill.review' => ['platform.ai.skill_management'],
        'platform.skill.market' => ['platform.ai.skill_management'],
    ],

    /*
     * 需要从权限树中隐藏的资源。
     *
     * 用途：
     * - 保留旧资源的 permission_tag / 兼容判权能力
     * - 但不再在新的权限树里继续展示旧复合资源，避免与目标资源重复出现
     */
    'hidden_resource_keys' => [
        'platform.model.text',
        'platform.model.image',
        'platform.model.video',
        'platform.ai.image_generation',
        'platform.ai.mode_management',
        'workspace.model.text',
        'workspace.model.image',
        'workspace.model.video',
        'workspace.ai.image_generation',
        'platform.ai.agent_management',
        'platform.ai.skill_management',
        'platform.ai.model_audit_log',
    ],

    /*
     * 官方组织不展示的组织级资源。
     *
     * 这些资源仍保留真实 permission key 和接口鉴权能力；这里只控制官方组织的
     * 子管理员权限树，避免把仅属于普通组织的菜单配置项展示给平台管理员。
     */
    'official_organization_hidden_resource_keys' => [
        'admin.ai.application.menu',
        'admin.setting.identity_watermark',
        'workspace.ai.model_management',
        'workspace.model.text',
        'workspace.model.image',
        'workspace.model.video',
        'workspace.ai.model_audit_statistics',
    ],

    /*
     * 菜单别名映射（仅影响权限树展示，不影响 permission_tag 与接口鉴权）。
     *
     * 用途：
     * - 当前产品存在“多个菜单入口复用同一组权限资源”的场景
     * - 例如视频大模型、Skill 审核/市场、员工审核/市场
     * - 主路径仍由 resource_menu_mapping 决定，这里只追加别名菜单节点
     */
    'resource_menu_alias_mapping' => [],
];
