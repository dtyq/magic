<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Constant;

use InvalidArgumentException;

/**
 * STS 权限类型及表达式解析器。
 */
final class StsType
{
    public const UPLOAD_OBJECTS = 'upload_objects';

    public const LIST_OBJECTS = 'list_objects';

    public const DEL_OBJECTS = 'del_objects';

    public const SET_OBJECT_META = 'set_object_meta';

    /**
     * 解析并规范化 STS 权限表达式。
     *
     * @return array<int, string>
     */
    public static function parse(string $expression): array
    {
        if ($expression === '') {
            return [];
        }

        $types = [];
        foreach (explode('|', $expression) as $type) {
            $type = trim($type);
            if ($type === '') {
                continue;
            }
            if (! in_array($type, self::all(), true)) {
                throw new InvalidArgumentException("不支持的 STS 权限类型: {$type}");
            }
            $types[$type] = true;
        }

        $types = array_keys($types);
        return array_values(array_intersect(self::all(), $types));
    }

    /**
     * 将权限类型数组转换为稳定的表达式。
     *
     * @param array<int, string> $types
     */
    public static function join(array $types): string
    {
        return implode('|', self::parse(implode('|', $types)));
    }

    /**
     * 获取当前支持的权限类型。
     *
     * @return array<int, string>
     */
    public static function all(): array
    {
        return [
            self::UPLOAD_OBJECTS,
            self::LIST_OBJECTS,
            self::DEL_OBJECTS,
            self::SET_OBJECT_META,
        ];
    }
}
