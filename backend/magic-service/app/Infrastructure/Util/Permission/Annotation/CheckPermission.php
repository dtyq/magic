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
     * 资源标识.
     */
    public string $resource;

    /**
     * 操作标识.
     */
    public string $operation;

    public function __construct(BackedEnum|string $resource, BackedEnum|string $operation)
    {
        $this->resource = $resource instanceof BackedEnum ? $resource->value : $resource;
        $this->operation = $operation instanceof BackedEnum ? $operation->value : $operation;
    }

    /**
     * 组合为完整权限键，如 "console.api.assistant.query".
     */
    public function getPermissionKey(): string
    {
        $permission = di(MagicPermissionInterface::class);
        return $permission->buildPermission($this->resource, $this->operation);
    }
}
