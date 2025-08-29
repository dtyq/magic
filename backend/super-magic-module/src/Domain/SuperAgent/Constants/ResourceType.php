<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constants;

/**
 * 资源类型常量.
 */
final class ResourceType
{
    public const PROJECT = 'project';

    public const TOPIC = 'topic';

    public const FILE = 'file';

    public const DIRECTORY = 'directory';

    public const MEMBER = 'member';

    /**
     * 获取所有资源类型.
     */
    public static function getAllTypes(): array
    {
        return [
            self::PROJECT,
            self::TOPIC,
            self::FILE,
            self::DIRECTORY,
            self::MEMBER,
        ];
    }

    /**
     * 验证资源类型是否有效.
     */
    public static function isValidType(string $type): bool
    {
        return in_array($type, self::getAllTypes(), true);
    }
}
