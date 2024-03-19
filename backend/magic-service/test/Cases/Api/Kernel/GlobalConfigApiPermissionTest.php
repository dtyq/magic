<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Kernel;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Kernel\Facade\GlobalConfigApi;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class GlobalConfigApiPermissionTest extends TestCase
{
    public function testUpdateGlobalConfigUsesMaintenanceEditPermission(): void
    {
        $method = new ReflectionMethod(GlobalConfigApi::class, 'updateGlobalConfig');
        $attributes = $method->getAttributes(CheckPermission::class);

        $this->assertCount(1, $attributes);

        /** @var CheckPermission $permission */
        $permission = $attributes[0]->newInstance();

        $this->assertSame([MagicResourceEnum::PLATFORM_SETTING_MAINTENANCE->value], $permission->resource);
        $this->assertSame(MagicOperationEnum::EDIT->value, $permission->operation);
    }
}
