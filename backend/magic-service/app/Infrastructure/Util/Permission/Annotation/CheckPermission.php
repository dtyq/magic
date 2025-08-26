<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Annotation;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use Attribute;
use BackedEnum;
use Hyperf\Di\Annotation\AbstractAnnotation;

/**
 * 权限校验注解，用于方法或类上声明所需的权限。
 *
 * 示例：
 * #[CheckPermission(MagicResourceEnum::CONSOLE_API_ASSISTANT, MagicOperationEnum::QUERY)]
 */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
class CheckPermission extends AbstractAnnotation
{
    /**
     * 资源标识（支持单个或多个）。
     */
    public array|string $resource;

    /**
     * 操作标识（仅支持单个）。
     */
    public string $operation;

    /**
     * @param array|BackedEnum|string $resource 资源，字符串/枚举或其数组
     * @param BackedEnum|string $operation 操作，仅字符串或枚举
     */
    public function __construct(array|BackedEnum|string $resource, BackedEnum|string $operation)
    {
        $this->resource = $this->normalizeToValues($resource);
        $this->operation = $operation instanceof BackedEnum ? $operation->value : $operation;
    }

    /**
     * 组合为完整权限键，如 "console.api.assistant.query".
     */
    public function getPermissionKey(): string
    {
        // 为了兼容旧逻辑，返回第一个组合键
        $keys = $this->getPermissionKeys();
        return $keys[0] ?? '';
    }

    /**
     * 返回所有权限键组合（resources x operations 的笛卡尔积）。
     * 当声明了多个资源或多个操作时，权限通过任意一个键即可。
     *
     * @return array<string>
     */
    public function getPermissionKeys(): array
    {
        $permission = di(MagicPermissionInterface::class);

        $resources = is_array($this->resource) ? $this->resource : [$this->resource];

        $keys = [];
        foreach ($resources as $res) {
            $keys[] = $permission->buildPermission($res, $this->operation);
        }

        return $keys;
    }

    /**
     * 将字符串/枚举或其数组统一为字符串数组。
     * @return array<string>
     */
    private function normalizeToValues(array|BackedEnum|string $input): array
    {
        $toValue = static function ($item) {
            return $item instanceof BackedEnum ? $item->value : $item;
        };

        if (is_array($input)) {
            $values = [];
            foreach ($input as $item) {
                $values[] = $toValue($item);
            }
            return $values;
        }

        return [$toValue($input)];
    }
}
