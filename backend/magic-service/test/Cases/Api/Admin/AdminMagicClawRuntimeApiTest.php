<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Admin\SuperMagic\Agent\AdminMagicClawRuntimeApi;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Contract\ConfigInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use HyperfTest\Support\MagicClawTestEnvironment;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionProperty;

/** @internal */
final class AdminMagicClawRuntimeApiTest extends TestCase
{
    use MagicClawTestEnvironment;

    public function testShowUsesAuthenticatedOrganizationAndRetainsQueryPermission(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::once())->method('status')->with('authenticated-org')->willReturn(null);
        self::assertSame(['runtime_reconciliation' => null], $this->api($service)->show());
        $this->assertPermission('show', MagicOperationEnum::QUERY);
    }

    public function testRetryUsesAuthenticatedOrganizationAndPreservesStringIdentifier(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::once())->method('retry')->with('authenticated-org', '900000000000000001')->willReturn(['status' => 'running']);
        self::assertSame(['status' => 'running'], $this->api($service, '900000000000000001')->retry());
        $this->assertPermission('retry', MagicOperationEnum::EDIT);
    }

    public function testRetryRejectsInvalidOperationIdentifier(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::never())->method('retry');
        $this->expectException(BusinessException::class);
        $this->api($service, 'invalid-id')->retry();
    }

    private function api(MagicClawReconciliationAppService $service, string $operationId = ''): AdminMagicClawRuntimeApi
    {
        $config = $this->createMock(ConfigInterface::class);
        $errorConfig = require BASE_PATH . '/config/autoload/error_message.php';
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => $key === 'error_message' ? $errorConfig : $default);
        $this->prepareClawEnvironment([MagicClawReconciliationAppService::class => $service, ConfigInterface::class => $config]);
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $authorization->method('getOrganizationCode')->willReturn('authenticated-org');
        $api = $this->getMockBuilder(AdminMagicClawRuntimeApi::class)->disableOriginalConstructor()->onlyMethods(['getAuthorization'])->getMock();
        $api->method('getAuthorization')->willReturn($authorization);
        $request = $this->createMock(RequestInterface::class);
        $request->method('input')->with('operation_id', '')->willReturn($operationId);
        (new ReflectionProperty(AdminMagicClawRuntimeApi::class, 'request'))->setValue($api, $request);
        return $api;
    }

    private function assertPermission(string $method, MagicOperationEnum $operation): void
    {
        $attributes = (new ReflectionMethod(AdminMagicClawRuntimeApi::class, $method))->getAttributes(CheckPermission::class);
        self::assertCount(1, $attributes);
        $annotation = $attributes[0]->newInstance();
        self::assertSame([MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION->value], $annotation->resource);
        self::assertSame($operation->value, $annotation->operation);
    }
}
