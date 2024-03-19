<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

use function Hyperf\Translation\__;

enum TextColor: string
{
    case DEFAULT = 'default';
    case GREEN = 'green';
    case ORANGE = 'orange';
    case RED = 'red';

    /**
     * 从字符串获取颜色实例.
     */
    public static function fromString(string $color): self
    {
        return match ($color) {
            self::DEFAULT->value => self::DEFAULT,
            self::GREEN->value => self::GREEN,
            self::ORANGE->value => self::ORANGE,
            self::RED->value => self::RED,
            default => ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_color_invalid'),
        };
    }

    /**
     * 获取所有颜色选项及其国际化标签.
     * @return array<string, string> 返回颜色名称和对应的值
     */
    public static function getColorOptions(): array
    {
        return [
            __('agent.text_color_default') => self::DEFAULT->value,
            __('agent.text_color_green') => self::GREEN->value,
            __('agent.text_color_orange') => self::ORANGE->value,
            __('agent.text_color_red') => self::RED->value,
        ];
    }

    /**
     * 验证颜色值是否有效.
     */
    public static function isValid(string $color): bool
    {
        return in_array($color, [
            self::DEFAULT->value,
            self::GREEN->value,
            self::ORANGE->value,
            self::RED->value,
        ], true);
    }
}
