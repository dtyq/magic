<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use ValueError;

/**
 * 任务文件来源枚举.
 */
enum TaskFileSource: int
{
    case DEFAULT = 0;

    /**
     * 首页.
     */
    case HOME = 1;

    /**
     * 项目目录.
     */
    case PROJECT_DIRECTORY = 2;

    /**
     * Agent.
     */
    case AGENT = 3;

    case COPY = 4;
    case AI_IMAGE_GENERATION = 5;

    /**
     * 移动.
     */
    case MOVE = 6;

    case AI_VIDEO_GENERATION = 7;

    /**
     * Skill.
     */
    case SKILL = 8;

    /**
     * 是否为 AI 生成来源.
     */
    public function isAIGenerated(): bool
    {
        return match ($this) {
            self::AI_IMAGE_GENERATION, self::AI_VIDEO_GENERATION => true,
            default => false,
        };
    }

    /**
     * 获取来源名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::DEFAULT => '默认',
            self::HOME => '首页',
            self::PROJECT_DIRECTORY => '项目目录',
            self::AGENT => 'Agent',
            self::COPY => '复制',
            self::AI_IMAGE_GENERATION => 'AI图片生成',
            self::MOVE => '移动',
            self::SKILL => 'Skill',
            self::AI_VIDEO_GENERATION => 'AI视频生成',
        };
    }

    /**
     * 从字符串或整数创建枚举实例.
     */
    public static function fromValue(int|string $value): self
    {
        try {
            return self::fromStrictValue($value);
        } catch (ValueError) {
            return self::DEFAULT;
        }
    }

    /**
     * 从字符串或整数严格创建枚举实例.
     */
    public static function fromStrictValue(int|string $value): self
    {
        if (is_string($value)) {
            if (! preg_match('/^-?\d+$/', $value)) {
                throw new ValueError(sprintf('"%s" is not a valid backing value for enum %s', $value, self::class));
            }
            $value = (int) $value;
        }

        return match ($value) {
            1 => self::HOME,
            2 => self::PROJECT_DIRECTORY,
            3 => self::AGENT,
            4 => self::COPY,
            5 => self::AI_IMAGE_GENERATION,
            6 => self::MOVE,
            7 => self::AI_VIDEO_GENERATION,
            8 => self::SKILL,
            default => self::DEFAULT,
        };
    }
}
