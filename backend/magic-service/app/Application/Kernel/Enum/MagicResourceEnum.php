<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Enum;

use function Hyperf\Translation\__;

/**
 * Magic 资源枚举（首版草案）.
 *
 * 1. 使用 Backed Enum 将每个资源映射为唯一字符串 key。
 * 2. 通过方法提供 label / parent / module 等元信息，方便后续生成权限树、做 i18n 等。
 * 3. 仅定义资源本身，不涉及操作类型（如 query / edit）。
 *
 * 说明：当前文件为草案，暂不替换现有 MagicPermissionEnum 中的资源常量，
 * 后续验证无误后再做迁移。
 */
enum MagicResourceEnum: string
{
    // ===== 顶级：平台 =====
    case ADMIN = 'Admin';
    case CONSOLE = 'Console';

    // ===== 二级：模块 =====
    case ADMIN_AI = 'Admin.ai';
    case CONSOLE_API = 'Console.api';

    // ===== 三级：具体资源 =====
    case ADMIN_AI_MODEL = 'Admin.ai.model_management';
    case ADMIN_AI_IMAGE = 'Admin.ai.image_generation';
    case CONSOLE_API_ASSISTANT = 'Console.api.assistant';

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
            self::ADMIN,
            self::CONSOLE => null,
            self::ADMIN_AI => self::ADMIN,
            self::ADMIN_AI_MODEL,
            self::ADMIN_AI_IMAGE => self::ADMIN_AI,
            self::CONSOLE_API => self::CONSOLE,
            self::CONSOLE_API_ASSISTANT => self::CONSOLE_API,
        };
    }

    /**
     * 返回统一的元信息数组，便于序列化 / JSON 输出.
     */
    public function meta(): array
    {
        return [
            'key' => $this->value,
            'label' => $this->label(),
            'parent' => $this->parent()?->value,
        ];
    }
}
