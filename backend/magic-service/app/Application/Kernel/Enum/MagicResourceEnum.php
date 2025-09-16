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
    case ADMIN = 'admin'; # 组织管理后台
    case PLATFORM = 'platform'; # 平台管理后台

    // ===== 二级：模块 =====
    case ADMIN_AI = 'platform.ai'; # 平台管理后台-AI管理
    case ADMIN_SAFE = 'admin.safe'; # 安全管控
    case PLATFORM_SETTING = 'platform.setting'; # 系统设置

    // ===== 三级：具体资源 (用于具体绑定接口）=====
    case ADMIN_AI_MODEL = 'platform.ai.model_management'; # AI管理-模型管理
    case ADMIN_AI_IMAGE = 'platform.ai.image_generation'; # AI管理-智能绘图管理
    case ADMIN_AI_MODE = 'platform.ai.mode_management'; # AI管理-模式管理管理
    case ADMIN_AI_AUDIT = 'platform.ai.content_audit'; # AI管理-AI内容审核
    case SAFE_SUB_ADMIN = 'admin.safe.sub_admin';  # 安全管控-子管理员
    case PLATFORM_SETTING_MAINTENANCE = 'platform.setting.maintenance'; # 平台管理 - 系统信息 - 维护管理

    /**
     * 对应 i18n key.
     */
    public function translationKey(): string
    {
        return match ($this) {
            self::ADMIN => 'permission.resource.admin',
            self::ADMIN_AI => 'permission.resource.admin_ai',
            self::ADMIN_SAFE => 'permission.resource.admin_safe', # 安全与权限
            self::ADMIN_AI_MODEL => 'permission.resource.ai_model',
            self::ADMIN_AI_IMAGE => 'permission.resource.ai_image',
            self::ADMIN_AI_MODE => 'permission.resource.ai_mode',
            self::ADMIN_AI_AUDIT => 'permission.resource.ai_content_audit',
            self::SAFE_SUB_ADMIN => 'permission.resource.safe_sub_admin', # 子管理员
            self::PLATFORM => 'permission.resource.platform',
            self::PLATFORM_SETTING => 'permission.resource.platform_setting',
            self::PLATFORM_SETTING_MAINTENANCE => 'permission.resource.platform_setting_maintenance',
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
            self::PLATFORM => null,
            // 模块
            self::ADMIN_AI,
            self::PLATFORM_SETTING => self::PLATFORM,
            self::ADMIN_SAFE => self::ADMIN,
            // 操作资源
            self::ADMIN_AI_MODEL,
            self::ADMIN_AI_IMAGE,
            self::ADMIN_AI_AUDIT,
            self::ADMIN_AI_MODE => self::ADMIN_AI,
            self::SAFE_SUB_ADMIN => self::ADMIN_SAFE,
            self::PLATFORM_SETTING_MAINTENANCE => self::PLATFORM_SETTING,
        };
    }

    public function label(): string
    {
        return __($this->translationKey());
    }
}
