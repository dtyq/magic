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
 */
enum MagicResourceEnum: string
{
    // ===== 顶级：平台 =====
    case ADMIN = 'admin';

    // ===== 二级：模块 =====
    case ADMIN_AI = 'admin.ai';
    case ADMIN_SAFE = 'admin.safe'; # 安全与权限

    // ===== 三级：具体资源 (用于具体绑定接口）=====
    case ADMIN_AI_MODEL = 'admin.ai.model_management'; # 模型管理
    case ADMIN_AI_IMAGE = 'admin.ai.image_generation';
    case SAFE_SUB_ADMIN = 'admin.safe.sub_admin';  # 安全-子管理员

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
            self::SAFE_SUB_ADMIN => 'permission.resource.safe_sub_admin', # 子管理员
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
            self::ADMIN => null,
            // 模块
            self::ADMIN_AI,
            self::ADMIN_SAFE => self::ADMIN,
            // 操作资源
            self::ADMIN_AI_MODEL,
            self::ADMIN_AI_IMAGE => self::ADMIN_AI,
            self::SAFE_SUB_ADMIN => self::ADMIN_SAFE,
        };
    }

    public function label(): string
    {
        return __($this->translationKey());
    }
}
