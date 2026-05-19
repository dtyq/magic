<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Enum;

use Throwable;

use function Hyperf\Translation\__;

/**
 * Magic 资源枚举.
 *
 * 1. 使用 Backed Enum 将每个资源映射为唯一字符串 key。
 * 2. 通过方法提供 label / parent  等元信息，方便后续生成权限树、做 i18n 等。
 * 3. 仅定义资源本身，不涉及操作类型（如 query / edit）。
 *
 * 注意：如果你修改了这个文件，请执行单元测试 PermissionApiTest.testGetPermissionTree.
 */
enum MagicResourceEnum: string
{
    // ===== 顶级 =====
    case PLATFORM = 'platform'; # 平台管理后台
    case WORKSPACE = 'workspace'; # 组织工作区后台
    case ADMIN = 'admin'; # 组织管理后台

    // ===== 二级：模块 =====
    case ADMIN_AI = 'admin.ai'; # 组织管理后台-AI管理
    case ADMIN_SAFE = 'admin.safe'; # 安全管控
    case ADMIN_SAFE_FUNCTION_PERMISSION = 'admin.safe.function_permission'; # 安全管控-功能权限
    case PLATFORM_AI = 'platform.ai'; # 平台管理后台-AI管理
    case PLATFORM_AGENT = 'platform.agent'; # 平台管理后台-官方内置员工
    case PLATFORM_SKILL = 'platform.skill'; # 平台管理后台-Skill
    case PLATFORM_MODEL = 'platform.model'; # 平台管理后台-平台模型
    case WORKSPACE_AI = 'workspace.ai'; # 工作区-AI管理
    case WORKSPACE_MODEL = 'workspace.model'; # 工作区-自定义大模型
    case PLATFORM_SETTING = 'platform.setting'; # 系统设置
    case PLATFORM_ORGANIZATION = 'platform.organization'; # 组织管理

    // ===== 三级：具体资源 (用于具体绑定接口）=====
    case PLATFORM_MODEL_TEXT = 'platform.model.text'; # 平台管理-平台模型-文本大模型
    case PLATFORM_MODEL_IMAGE = 'platform.model.image'; # 平台管理-平台模型-生图大模型
    case PLATFORM_MODEL_VIDEO = 'platform.model.video'; # 平台管理-平台模型-视频大模型
    case PLATFORM_AI_MODEL = 'platform.ai.model_management'; # 平台管理-AI管理-模型管理
    case PLATFORM_AI_IMAGE = 'platform.ai.image_generation'; # 平台管理-AI管理-智能绘图管理
    case PLATFORM_AI_MODEL_AUDIT_LOG = 'platform.ai.model_audit_log'; # 平台管理-AI管理-模型调用审计
    case WORKSPACE_MODEL_TEXT = 'workspace.model.text'; # 工作区-自定义大模型-文本大模型
    case WORKSPACE_MODEL_IMAGE = 'workspace.model.image'; # 工作区-自定义大模型-生图大模型
    case WORKSPACE_MODEL_VIDEO = 'workspace.model.video'; # 工作区-自定义大模型-视频大模型
    case WORKSPACE_AI_MODEL = 'workspace.ai.model_management'; # 工作区-AI管理-模型管理
    case WORKSPACE_AI_IMAGE = 'workspace.ai.image_generation'; # 工作区-AI管理-智能绘图管理
    case WORKSPACE_AI_MODEL_AUDIT_LOG = 'workspace.ai.model_audit_log'; # 工作区-AI管理-模型调用审计
    case PLATFORM_AI_MODEL_AUDIT_STATISTICS = 'platform.ai.model_audit_statistics'; # 平台管理-AI管理-模型调用统计
    case WORKSPACE_AI_MODEL_AUDIT_STATISTICS = 'workspace.ai.model_audit_statistics'; # 工作区-AI管理-模型调用统计
    case ADMIN_AI_MODE = 'platform.ai.mode_management'; # AI管理-模式管理管理
    case ADMIN_AI_ABILITY = 'platform.ai.ability'; # AI管理-能力管理
    case ADMIN_AI_MODEL_ACCESS_ROLE = 'admin.ai.model_access_role'; # AI管理-自定义大模型-模型访问权限
    case SAFE_ADMIN = 'admin.safe.admin';  # 安全管控-组织管理员
    case SAFE_SUB_ADMIN = 'admin.safe.sub_admin';  # 组织管理后台-安全管控-子管理员
    case SAFE_OPERATION_LOG = 'admin.safe.operation_log';  # 安全管控-操作日志
    case PLATFORM_AGENT_OFFICIAL = 'platform.agent.official'; # 智能体增强-官方内置员工
    case PLATFORM_AGENT_REVIEW = 'platform.agent.review'; # 智能体增强-员工审核
    case PLATFORM_AGENT_MARKET = 'platform.agent.market'; # 智能体增强-员工市场
    case PLATFORM_SKILL_REVIEW = 'platform.skill.review'; # 智能体增强-Skill审核
    case PLATFORM_SKILL_MARKET = 'platform.skill.market'; # 智能体增强-Skill市场
    case PLATFORM_ADMIN_AI_AGENT = 'platform.ai.agent_management'; # AI管理-员工管理
    case PLATFORM_ADMIN_AI_SKILL = 'platform.ai.skill_management'; # AI管理-技能管理
    case PLATFORM_SETTING_PLATFORM_INFO = 'platform.setting.platform_info'; # 平台管理 - 系统设置 - 平台信息
    case PLATFORM_SETTING_MAINTENANCE = 'platform.setting.maintenance'; # 平台管理 - 系统信息 - 维护管理
    case PLATFORM_SETTING_APPLICATION = 'platform.setting.application'; # 平台管理 - 系统设置 - 应用菜单
    case PLATFORM_ORGANIZATION_LIST = 'platform.organization.list'; # 平台管理 - 组织管理 - 组织列表
    case PLATFORM_USER_LIST = 'platform.organization.user_list'; # 平台管理 - 组织管理 - 平台用户列表
    case WORKSPACE_ADMIN_AI_AGENT = 'workspace.ai.agent_management'; # AI管理-数字员工
    case WORKSPACE_ADMIN_AI_SKILL = 'workspace.ai.skill_management'; # AI管理-Skill

    /**
     * 对应 i18n key.
     */
    public function translationKey(): string
    {
        return match ($this) {
            self::ADMIN => 'permission.resource.admin',
            self::WORKSPACE => 'permission.resource.workspace',
            self::ADMIN_AI => 'permission.resource.admin_ai',
            self::ADMIN_SAFE => 'permission.resource.admin_safe', # 安全与权限
            self::ADMIN_SAFE_FUNCTION_PERMISSION => 'permission.resource.safe_function_permission',
            self::PLATFORM_AGENT => 'permission.resource.platform_agent',
            self::PLATFORM_SKILL => 'permission.resource.platform_skill',
            self::PLATFORM_MODEL => 'permission.resource.platform_model',
            self::PLATFORM_MODEL_TEXT => 'permission.resource.platform_model_text',
            self::PLATFORM_MODEL_IMAGE => 'permission.resource.platform_model_image',
            self::PLATFORM_MODEL_VIDEO => 'permission.resource.platform_model_video',
            self::PLATFORM_AI_MODEL => 'permission.resource.ai_model',
            self::WORKSPACE_MODEL => 'permission.resource.workspace_model',
            self::WORKSPACE_MODEL_TEXT => 'permission.resource.workspace_model_text',
            self::WORKSPACE_MODEL_IMAGE => 'permission.resource.workspace_model_image',
            self::WORKSPACE_MODEL_VIDEO => 'permission.resource.workspace_model_video',
            self::WORKSPACE_AI_MODEL => 'permission.resource.workspace_ai_model',
            self::PLATFORM_AI_IMAGE => 'permission.resource.ai_image',
            self::WORKSPACE_AI_IMAGE => 'permission.resource.workspace_ai_image',
            self::PLATFORM_AI_MODEL_AUDIT_LOG => 'permission.resource.platform_ai_model_audit_log',
            self::WORKSPACE_AI_MODEL_AUDIT_LOG => 'permission.resource.workspace_ai_model_audit_log',
            self::PLATFORM_AI_MODEL_AUDIT_STATISTICS => 'permission.resource.platform_ai_model_audit_statistics',
            self::WORKSPACE_AI_MODEL_AUDIT_STATISTICS => 'permission.resource.workspace_ai_model_audit_statistics',
            self::ADMIN_AI_MODE => 'permission.resource.ai_mode',
            self::ADMIN_AI_ABILITY => 'permission.resource.ai_ability',
            self::WORKSPACE_ADMIN_AI_AGENT => 'permission.resource.admin_ai_agent',
            self::WORKSPACE_ADMIN_AI_SKILL => 'permission.resource.admin_ai_skill',
            self::ADMIN_AI_MODEL_ACCESS_ROLE => 'permission.resource.admin_ai_model_access_role',
            self::SAFE_ADMIN => 'permission.resource.safe_admin',
            self::PLATFORM_AGENT_OFFICIAL => 'permission.resource.platform_agent_official',
            self::PLATFORM_AGENT_REVIEW => 'permission.resource.platform_agent_review',
            self::PLATFORM_AGENT_MARKET => 'permission.resource.platform_agent_market',
            self::PLATFORM_SKILL_REVIEW => 'permission.resource.platform_skill_review',
            self::PLATFORM_SKILL_MARKET => 'permission.resource.platform_skill_market',
            self::PLATFORM_ADMIN_AI_AGENT => 'permission.resource.ai_agent',
            self::PLATFORM_ADMIN_AI_SKILL => 'permission.resource.ai_skill',
            self::SAFE_SUB_ADMIN => 'permission.resource.safe_sub_admin', # 子管理员
            self::SAFE_OPERATION_LOG => 'permission.resource.safe_operation_log',
            self::PLATFORM => 'permission.resource.platform',
            self::PLATFORM_AI => 'permission.resource.platform_ai',
            self::WORKSPACE_AI => 'permission.resource.workspace_ai',
            self::PLATFORM_SETTING => 'permission.resource.platform_setting',
            self::PLATFORM_SETTING_PLATFORM_INFO => 'permission.resource.platform_setting_platform_info',
            self::PLATFORM_SETTING_MAINTENANCE => 'permission.resource.platform_setting_maintenance',
            self::PLATFORM_SETTING_APPLICATION => 'permission.resource.platform_setting_application',
            self::PLATFORM_ORGANIZATION => 'permission.resource.platform_organization',
            self::PLATFORM_ORGANIZATION_LIST => 'permission.resource.platform_organization_list',
            self::PLATFORM_USER_LIST => 'permission.resource.platform_user_list',
        };
    }

    /**
     * 上级资源.
     * 注意：新增操作资源后要补充这个配置.
     */
    public function parent(): ?self
    {
        return match ($this) {
            // 平台
            self::ADMIN,
            self::PLATFORM,
            self::WORKSPACE => null,
            // 模块
            self::PLATFORM_AI,
            self::PLATFORM_AGENT,
            self::PLATFORM_SKILL,
            self::PLATFORM_MODEL,
            self::PLATFORM_SETTING,
            self::PLATFORM_ORGANIZATION => self::PLATFORM,
            self::WORKSPACE_AI => self::WORKSPACE,
            self::WORKSPACE_MODEL => self::WORKSPACE,
            self::ADMIN_AI,
            self::ADMIN_SAFE => self::ADMIN,
            self::ADMIN_SAFE_FUNCTION_PERMISSION => self::ADMIN_SAFE,
            // 操作资源
            self::PLATFORM_MODEL_TEXT,
            self::PLATFORM_MODEL_IMAGE,
            self::PLATFORM_MODEL_VIDEO => self::PLATFORM_MODEL,
            self::PLATFORM_AI_MODEL,
            self::PLATFORM_AI_IMAGE,
            self::PLATFORM_AI_MODEL_AUDIT_LOG,
            self::PLATFORM_AI_MODEL_AUDIT_STATISTICS,
            self::ADMIN_AI_MODE => self::PLATFORM_AI,
            self::WORKSPACE_MODEL_TEXT,
            self::WORKSPACE_MODEL_IMAGE,
            self::WORKSPACE_MODEL_VIDEO => self::WORKSPACE_MODEL,
            self::WORKSPACE_AI_MODEL,
            self::WORKSPACE_AI_IMAGE,
            self::WORKSPACE_AI_MODEL_AUDIT_LOG,
            self::WORKSPACE_AI_MODEL_AUDIT_STATISTICS => self::WORKSPACE_AI,
            self::ADMIN_AI_ABILITY,
            self::WORKSPACE_ADMIN_AI_AGENT,
            self::WORKSPACE_ADMIN_AI_SKILL,
            self::ADMIN_AI_MODEL_ACCESS_ROLE => self::ADMIN_AI,
            self::SAFE_ADMIN,
            self::SAFE_SUB_ADMIN,
            self::SAFE_OPERATION_LOG => self::ADMIN_SAFE,
            self::PLATFORM_AGENT_OFFICIAL,
            self::PLATFORM_AGENT_REVIEW,
            self::PLATFORM_AGENT_MARKET => self::PLATFORM_AGENT,
            self::PLATFORM_SKILL_REVIEW,
            self::PLATFORM_SKILL_MARKET => self::PLATFORM_SKILL,
            self::PLATFORM_ADMIN_AI_AGENT,
            self::PLATFORM_ADMIN_AI_SKILL,
            self::PLATFORM_SETTING_PLATFORM_INFO => self::PLATFORM_SETTING,
            self::PLATFORM_SETTING_MAINTENANCE => self::PLATFORM_SETTING,
            self::PLATFORM_SETTING_APPLICATION => self::PLATFORM_SETTING,
            self::PLATFORM_ORGANIZATION_LIST => self::PLATFORM_ORGANIZATION,
            self::PLATFORM_USER_LIST => self::PLATFORM_ORGANIZATION,
        };
    }

    public function label(): string
    {
        try {
            $label = __($this->translationKey());
        } catch (Throwable) {
            return $this->value;
        }

        return $label === $this->translationKey() ? $this->value : $label;
    }

    /**
     * 返回与该资源绑定的 Operation Enum 类名。
     * 默认使用 MagicOperationEnum。
     * 如需为特定资源自定义操作集，可在此返回自定义 Enum::class。
     */
    public function operationEnumClass(): string
    {
        return match ($this) {
            self::PLATFORM_AGENT_OFFICIAL => MagicQueryOperationEnum::class,
            default => MagicOperationEnum::class,
        };
    }
}
