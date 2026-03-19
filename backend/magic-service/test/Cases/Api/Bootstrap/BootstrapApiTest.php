<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Bootstrap;

use App\Application\Bootstrap\Service\BootstrapInitializationAppService;
use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Bootstrap\Facade\BootstrapApi;
use FastRoute\Dispatcher;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Router\Dispatched;
use Hyperf\Validation\ValidationException;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/**
 * @internal
 */
class BootstrapApiTest extends TestCase
{
    public function testExecuteDelegatesToInitializationAppServiceWithParsedDto(): void
    {
        $payload = [
            'admin_account' => [
                'phone' => '13800000000',
                'password' => 'ChangeMe123!',
            ],
            'agent_info' => [
                'name' => 'Super Assistant',
                'description' => 'Helps with daily tasks.',
            ],
            'service_provider_model' => [
                'provider_code' => 'openai',
                'model_version' => 'gpt-4o-mini',
                'category' => 'llm',
                'service_provider_config' => [
                    'api_key' => 'test-key',
                ],
            ],
            'select_official_agents_codes' => ['general', 'design'],
        ];

        $dispatched = new Dispatched([Dispatcher::FOUND, null, []]);

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn($payload);
        $request->expects($this->once())
            ->method('getAttribute')
            ->with(Dispatched::class)
            ->willReturn($dispatched);

        $expected = [
            'success' => true,
            'initialization' => [
                'organization' => ['success' => true],
            ],
        ];

        $service = $this->createMock(BootstrapInitializationAppService::class);
        $service->expects($this->once())
            ->method('initialize')
            ->with($this->callback(function (BootstrapExecuteRequestDTO $dto): bool {
                $this->assertSame('13800000000', $dto->getPhone());
                $this->assertSame('ChangeMe123!', $dto->getPassword());
                $this->assertSame('Super Assistant', $dto->getAgentName());
                $this->assertSame('Helps with daily tasks.', $dto->getAgentDescription());
                $this->assertSame(['general', 'design'], $dto->getSelectOfficialAgentsCodes());

                $serviceProviderModel = $dto->getServiceProviderModel();
                $this->assertNotNull($serviceProviderModel);
                $this->assertSame('openai', $serviceProviderModel->getProviderCode());
                $this->assertSame('gpt-4o-mini', $serviceProviderModel->getModelVersion());
                $this->assertSame('llm', $serviceProviderModel->getCategory());
                $this->assertSame(['api_key' => 'test-key'], $serviceProviderModel->getServiceProviderConfig());

                return true;
            }))
            ->willReturn($expected);

        $api = $this->createApi($request);
        $property = new ReflectionProperty(BootstrapApi::class, 'bootstrapInitializationAppService');
        $property->setValue($api, $service);

        $result = $api->execute($request);

        $this->assertSame($expected, $result);
    }

    public function testExecuteThrowsValidationExceptionWhenAdminAccountIsMissing(): void
    {
        $dispatched = new Dispatched([Dispatcher::FOUND, null, []]);

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn([]);
        $request->expects($this->once())
            ->method('getAttribute')
            ->with(Dispatched::class)
            ->willReturn($dispatched);

        $service = $this->createMock(BootstrapInitializationAppService::class);
        $service->expects($this->never())->method('initialize');

        $api = $this->createApi($request);
        $property = new ReflectionProperty(BootstrapApi::class, 'bootstrapInitializationAppService');
        $property->setValue($api, $service);

        $this->expectException(ValidationException::class);
        $api->execute($request);
    }

    public function testCheckStatusReturnsNeedInitialFromNoCacheReader(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $globalConfig = new GlobalConfig();
        $globalConfig->setNeedInitial(true);

        $magicSettingAppService = $this->createMock(MagicSettingAppService::class);
        $magicSettingAppService->expects($this->once())
            ->method('getWithoutCache')
            ->willReturn($globalConfig);

        $api = $this->createApi($request, $magicSettingAppService);
        $result = $api->checkStatus($request);

        $this->assertSame(['need_initial' => true], $result);
    }

    private function createApi(
        RequestInterface $request,
        ?MagicSettingAppService $magicSettingAppService = null
    ): BootstrapApi {
        if ($magicSettingAppService === null) {
            $magicSettingAppService = $this->createMock(MagicSettingAppService::class);
            $globalConfig = new GlobalConfig();
            $globalConfig->setNeedInitial(true);
            $magicSettingAppService->method('getWithoutCache')->willReturn($globalConfig);
        }

        return new BootstrapApi($request, $magicSettingAppService);
    }
}
