<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\UserSetting;

/**
 * {@see UserSettingKey::PersonalPreferences} 对应 value JSON 内的字段名（可随业务扩展）.
 *
 * 示例 value：
 * {
 *   "add_ai_watermark": false,
 *   "long_term_memory_enabled": true,
 *   …
 * }
 */
final class PersonalPreferencesKeys
{
    /** 是否为 AI 生成内容添加明水印；未传时业务侧按默认（通常为 true）处理 */
    public const ADD_AI_WATERMARK = 'add_ai_watermark';

    /** 是否启用长期记忆自动读取和自动提取；未传或非法值时按 true 处理 */
    public const LONG_TERM_MEMORY_ENABLED = 'long_term_memory_enabled';

    /**
     * CHAT metadata 中的追问开关字段名。
     * 值来自用户资料，不写入 magic_user_settings，因此不能加入 defaultValues()。
     */
    public const SHOW_FOLLOW_UP_SUGGESTIONS = 'show_follow_up_suggestions';

    /**
     * PersonalPreferences value 的默认值（扩展新字段时在此补充）.
     *
     * @return array<string, mixed>
     */
    public static function defaultValues(): array
    {
        return [
            self::ADD_AI_WATERMARK => true,
            self::LONG_TERM_MEMORY_ENABLED => true,
        ];
    }

    /**
     * 将当前已存储值与 {@see defaultValues()} 合并，已存储字段覆盖默认值.
     *
     * @param array<string, mixed> $current
     * @return array<string, mixed>
     */
    public static function mergeWithDefaults(array $current): array
    {
        return array_merge(self::defaultValues(), $current);
    }
}
