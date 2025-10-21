<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Enum;

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
    case ADMIN = 'admin'; # 组织管理后台
    case ADMINPLUS = 'admin_plus'; # 组织管理后台plus

    // ===== 二级：模块 =====
    case ADMIN_AI = 'admin.ai'; # 平台管理后台-AI管理
    case ADMIN_SAFE = 'admin.safe'; # 安全管控
    case PLATFORM_AI = 'platform.ai'; # 平台管理后台-AI管理
    case PLATFORM_SETTING = 'platform.setting'; # 系统设置
    case PLATFORM_ORGANIZATION = 'platform.organization'; # 组织管理
    case ADMINPLUS_AI = 'admin_plus.ai'; # 组织管理后台plus-AI管理

    // ===== 三级：具体资源 (用于具体绑定接口）=====
    case ADMIN_AI_MODEL = 'platform.ai.model_management'; # AI管理-模型管理
    case ADMIN_AI_IMAGE = 'platform.ai.image_generation'; # AI管理-智能绘图管理
    case ADMIN_AI_MODE = 'platform.ai.mode_management'; # AI管理-模式管理管理
    case SAFE_SUB_ADMIN = 'admin.safe.sub_admin';  # 安全管控-子管理员
    case PLATFORM_SETTING_MAINTENANCE = 'platform.setting.maintenance'; # 平台管理 - 系统信息 - 维护管理
    case PLATFORM_ORGANIZATION_LIST = 'platform.organization.list'; # 平台管理 - 组织管理 - 组织列表
    case PLATFORM_ORGANIZATION_WHITELIST = 'platform.organization.whitelist'; # 平台管理 - 组织管理 - 组织白名单
    case ADMINPLUS_AI_MODEL = 'admin_plus.ai.model_management'; # 组织管理后台plus-AI管理-模型管理

    /**
     * 对应 i18n key.
     */
    public function translationKey(): string
    {
        return match ($this) {
            self::ADMINPLUS => 'permission.resource.admin_plus',
            self::ADMIN => 'permission.resource.admin',
            self::ADMIN_AI => 'permission.resource.admin_ai',
            self::ADMINPLUS_AI => 'permission.resource.admin_plus_ai',
            self::ADMIN_SAFE => 'permission.resource.admin_safe', # 安全与权限
            self::ADMIN_AI_MODEL => 'permission.resource.ai_model',
            self::ADMINPLUS_AI_MODEL => 'permission.resource.ai_model',
            self::ADMIN_AI_IMAGE => 'permission.resource.ai_image',
            self::ADMIN_AI_MODE => 'permission.resource.ai_mode',
            self::SAFE_SUB_ADMIN => 'permission.resource.safe_sub_admin', # 子管理员
            self::PLATFORM => 'permission.resource.platform',
            self::PLATFORM_AI => 'permission.resource.platform_ai',
            self::PLATFORM_SETTING => 'permission.resource.platform_setting',
            self::PLATFORM_SETTING_MAINTENANCE => 'permission.resource.platform_setting_maintenance',
            self::PLATFORM_ORGANIZATION => 'permission.resource.platform_organization',
            self::PLATFORM_ORGANIZATION_LIST => 'permission.resource.platform_organization_list',
            self::PLATFORM_ORGANIZATION_WHITELIST => 'permission.resource.platform_organization_whitelist',
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
            self::ADMINPLUS,
            self::PLATFORM => null,
            // 模块
            self::PLATFORM_AI,
            self::PLATFORM_SETTING,
            self::PLATFORM_ORGANIZATION => self::PLATFORM,
            self::ADMIN_AI,
            self::ADMIN_SAFE => self::ADMIN,
            self::ADMINPLUS_AI => self::ADMINPLUS,
            // 操作资源
            self::ADMIN_AI_MODEL,
            self::ADMIN_AI_IMAGE,
            self::ADMIN_AI_MODE => self::PLATFORM_AI,
            self::SAFE_SUB_ADMIN => self::ADMIN_SAFE,
            self::PLATFORM_SETTING_MAINTENANCE => self::PLATFORM_SETTING,
            self::PLATFORM_ORGANIZATION_LIST => self::PLATFORM_ORGANIZATION,
            self::PLATFORM_ORGANIZATION_WHITELIST => self::PLATFORM_ORGANIZATION,
            self::ADMINPLUS_AI_MODEL => self::ADMINPLUS_AI,
        };
    }

    public function label(): string
    {
        return __($this->translationKey());
    }

    /**
     * 返回与该资源绑定的 Operation Enum 类名。
     * 默认使用 MagicOperationEnum。
     * 如需为特定资源自定义操作集，可在此返回自定义 Enum::class。
     */
    public function operationEnumClass(): string
    {
        return MagicOperationEnum::class;
    }
}
