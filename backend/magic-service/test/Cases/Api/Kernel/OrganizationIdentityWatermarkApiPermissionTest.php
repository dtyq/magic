<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Kernel;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Admin\Facade\OrganizationIdentityWatermarkApi;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class OrganizationIdentityWatermarkApiPermissionTest extends TestCase
{
    /**
     * @dataProvider endpointMethods
     */
    public function testIdentityWatermarkEndpointsUseOneDedicatedPermission(string $methodName): void
    {
        $attributes = (new ReflectionMethod(OrganizationIdentityWatermarkApi::class, $methodName))
            ->getAttributes(CheckPermission::class);

        $this->assertCount(1, $attributes);

        /** @var CheckPermission $permission */
        $permission = $attributes[0]->newInstance();
        $this->assertSame(
            [MagicResourceEnum::ADMIN_SETTING_IDENTITY_WATERMARK->value],
            $permission->resource
        );
        $this->assertSame(MagicOperationEnum::EDIT->value, $permission->operation);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function endpointMethods(): array
    {
        return [
            'show' => ['show'],
            'update' => ['update'],
        ];
    }
}
