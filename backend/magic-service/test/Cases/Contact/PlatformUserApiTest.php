<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Contact;

use App\Application\Contact\Service\PlatformUserAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Contact\Facade\Admin\PlatformUserApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
class PlatformUserApiTest extends TestCase
{
    public function testQueriesUsesDedicatedPlatformUserPermission(): void
    {
        $method = new ReflectionMethod(PlatformUserApi::class, 'queries');
        $attributes = $method->getAttributes(CheckPermission::class);

        $this->assertCount(1, $attributes);

        /** @var CheckPermission $permission */
        $permission = $attributes[0]->newInstance();

        $this->assertSame([MagicResourceEnum::PLATFORM_USER_LIST->value], $permission->resource);
        $this->assertSame(MagicOperationEnum::QUERY->value, $permission->operation);
    }

    public function testQueriesReturnsNormalizedPagination(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('input')->willReturnMap([
            ['page', 1, -3],
            ['page_size', 20, 5001],
            ['magic_id', null, null],
            ['phone', null, null],
            ['username', null, null],
        ]);

        $service = $this->createMock(PlatformUserAppService::class);
        $service->expects($this->once())
            ->method('queries')
            ->with(
                $this->callback(static function (Page $page): bool {
                    return $page->getPage() === 1 && $page->getPageNum() === 10;
                }),
                []
            )
            ->willReturn([
                'list' => [
                    ['user_id' => 'u_001'],
                ],
                'total' => 1,
            ]);

        $api = new PlatformUserApi($request);

        $property = new ReflectionProperty(PlatformUserApi::class, 'platformUserAppService');
        $property->setValue($api, $service);

        $result = $api->queries();

        $this->assertSame(1, $result['page']);
        $this->assertSame(10, $result['page_size']);
        $this->assertSame(1, $result['total']);
        $this->assertSame([['user_id' => 'u_001']], $result['list']);
    }
}
