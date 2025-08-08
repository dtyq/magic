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
    case CONSOLE = 'console';

    // ===== 二级：模块 =====
    case ADMIN_AI = 'admin.ai';
    case CONSOLE_API = 'console.api';

    // ===== 三级：具体资源 (用于具体绑定接口）=====
    case ADMIN_AI_MODEL = 'admin.ai.model_management';
    case ADMIN_AI_IMAGE = 'admin.ai.image_generation';
    case CONSOLE_API_ASSISTANT = 'console.api.assistant';

    /* --------------------------------------------------------------------- */
    /*                       元信息（Meta Information） */
    /* --------------------------------------------------------------------- */

    /**
     * 标签，使用 i18n 翻译.
     */
    public function label(): string
    {
        return __($this->translationKey());
    }

    /**
     * 对应 i18n key.
     */
    public function translationKey(): string
    {
        return match ($this) {
            self::ADMIN => 'permission.resource.admin',
            self::CONSOLE => 'permission.resource.console',
            self::ADMIN_AI => 'permission.resource.admin_ai',
            self::CONSOLE_API => 'permission.resource.api',
            self::ADMIN_AI_MODEL => 'permission.resource.ai_model',
            self::ADMIN_AI_IMAGE => 'permission.resource.ai_image',
            self::CONSOLE_API_ASSISTANT => 'permission.resource.api_assistant',
        };
    }

    /**
     * 上级资源（没有则返回 null）.
     */
    public function parent(): ?self
    {
        return match ($this) {
            // 平台
            self::ADMIN,
            self::CONSOLE => null,
            // 模块
            self::ADMIN_AI => self::ADMIN,
            self::CONSOLE_API => self::CONSOLE,
            // 操作资源
            self::ADMIN_AI_MODEL,
            self::ADMIN_AI_IMAGE => self::ADMIN_AI,
            self::CONSOLE_API_ASSISTANT => self::CONSOLE_API,
        };
    }
}
