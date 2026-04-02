<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Bootstrap;

use App\Application\Bootstrap\Service\BootstrapInitializationAppService;
use App\Application\Bootstrap\Service\BootstrapStatusService;
use App\Application\Bootstrap\ValueObject\BootstrapStatus;
use App\Application\ModelGateway\Service\OfficialVideoProviderInitAppService;
use App\Domain\VideoCatalog\Service\OfficialVideoProviderDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Bootstrap\Facade\BootstrapApi;
use FastRoute\Dispatcher;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Router\Dispatched;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\StreamInterface;
use Qbhy\HyperfAuth\Authenticatable;
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

        $request = $this->createDtoRequest($payload);
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);

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

        $api = $this->createApi($request, $statusService);
        $this->setInjectedProperty($api, 'bootstrapInitializationAppService', $service);

        $result = $this->unwrapSuccessResponse($api->execute($request));

        $this->assertSame($expected, $result);
    }

    public function testExecuteThrowsValidationExceptionWhenAdminAccountIsMissing(): void
    {
        $request = $this->createDtoRequest([]);
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);

        $service = $this->createMock(BootstrapInitializationAppService::class);
        $service->expects($this->never())->method('initialize');

        $api = $this->createApi($request, $statusService);
        $this->setInjectedProperty($api, 'bootstrapInitializationAppService', $service);

        $result = $api->execute($request);
        $this->assertErrorResponse($result, GenericErrorCode::ParameterValidationFailed->value, 'admin_account is required');
    }

    public function testCheckStatusReturnsBootstrapStatusFlags(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);

        $api = $this->createApi($request, $statusService);
        $result = $this->unwrapSuccessResponse($api->checkStatus($request));

        $this->assertSame([
            'status' => BootstrapStatus::Fresh->value,
            'need_initial' => true,
            'allow_bootstrap_execute' => true,
        ], $result);
    }

    public function testInitializeVideoProvidersDelegatesToAppServiceWithDecodedPayload(): void
    {
        $providers = [
            [
                'provider_code' => 'Cloudsway',
                'endpoint_key' => 'default',
                'provider' => ['name' => 'Video Gateway'],
                'config' => ['base_url' => 'https://example.com'],
                'models' => [],
            ],
        ];
        $request = $this->createBodyRequest(json_encode($providers, JSON_THROW_ON_ERROR));
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);
        $authorization = $this->createAuthorization(OfficialOrganizationUtil::getOfficialOrganizationCode());

        $expected = [
            'count' => 1,
            'skipped' => false,
            'message' => 'official video providers initialized',
        ];

        $service = $this->createVideoProviderInitAppService(
            callback: function (array $receivedProviders) use ($providers): array {
                $this->assertSame($providers, $receivedProviders);
                return [
                    'count' => 1,
                    'skipped' => false,
                    'message' => 'official video providers initialized',
                ];
            }
        );

        $api = $this->createApi($request, $statusService, $authorization);
        $this->setInjectedProperty($api, 'officialVideoProviderInitAppService', $service);

        $this->assertSame($expected, $this->unwrapSuccessResponse($api->initializeVideoProviders()));
    }

    public function testInitializeVideoProvidersThrowsWhenOrganizationIsNotOfficial(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);
        $authorization = $this->createAuthorization('non-official-org');

        $service = $this->createVideoProviderInitAppService(
            callback: function (): array {
                $this->fail('initializeWithProviders should not be called.');
            }
        );

        $api = $this->createApi($request, $statusService, $authorization);
        $this->setInjectedProperty($api, 'officialVideoProviderInitAppService', $service);

        $this->assertErrorResponse($api->initializeVideoProviders(), GenericErrorCode::AccessDenied->value, 'access_denied');
    }

    public function testInitializeVideoProvidersThrowsWhenJsonInvalid(): void
    {
        $request = $this->createBodyRequest('{invalid-json}');
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);
        $authorization = $this->createAuthorization(OfficialOrganizationUtil::getOfficialOrganizationCode());

        $service = $this->createVideoProviderInitAppService(
            callback: function (): array {
                $this->fail('initializeWithProviders should not be called.');
            }
        );

        $api = $this->createApi($request, $statusService, $authorization);
        $this->setInjectedProperty($api, 'officialVideoProviderInitAppService', $service);

        $this->assertErrorResponse(
            $api->initializeVideoProviders(),
            GenericErrorCode::ParameterValidationFailed->value,
            'invalid providers json'
        );
    }

    public function testInitializeVideoProvidersThrowsWhenPayloadIsNotArray(): void
    {
        $request = $this->createBodyRequest('"scalar"');
        $statusService = $this->createBootstrapStatusService(BootstrapStatus::Fresh);
        $authorization = $this->createAuthorization(OfficialOrganizationUtil::getOfficialOrganizationCode());

        $service = $this->createVideoProviderInitAppService(
            callback: function (): array {
                $this->fail('initializeWithProviders should not be called.');
            }
        );

        $api = $this->createApi($request, $statusService, $authorization);
        $this->setInjectedProperty($api, 'officialVideoProviderInitAppService', $service);

        $this->assertErrorResponse(
            $api->initializeVideoProviders(),
            GenericErrorCode::ParameterValidationFailed->value,
            'providers json must decode to an array'
        );
    }

    private function createApi(
        RequestInterface $request,
        BootstrapStatusService $bootstrapStatusService,
        ?MagicUserAuthorization $authorization = null,
    ): BootstrapApi {
        return new class($request, $bootstrapStatusService, $authorization) extends BootstrapApi {
            public function __construct(
                RequestInterface $request,
                BootstrapStatusService $bootstrapStatusService,
                private readonly ?MagicUserAuthorization $authorization,
            ) {
                parent::__construct($request, $bootstrapStatusService);
            }

            protected function getAuthorization(): Authenticatable
            {
                if ($this->authorization instanceof MagicUserAuthorization) {
                    return $this->authorization;
                }

                return parent::getAuthorization();
            }
        };
    }

    private function createBootstrapStatusService(BootstrapStatus $status): BootstrapStatusService
    {
        $service = $this->createMock(BootstrapStatusService::class);
        $service->method('getStatus')->willReturn($status);
        return $service;
    }

    /**
     * @param callable(array<string, mixed>|list<array<string, mixed>>): array{count:int,skipped:bool,message:string} $callback
     */
    private function createVideoProviderInitAppService(callable $callback): OfficialVideoProviderInitAppService
    {
        $domainService = $this->createMock(OfficialVideoProviderDomainService::class);

        return new readonly class($domainService, $callback) extends OfficialVideoProviderInitAppService {
            public function __construct(
                OfficialVideoProviderDomainService $officialVideoProviderDomainService,
                private mixed $callback,
            ) {
                parent::__construct($officialVideoProviderDomainService);
            }

            public function initializeWithProviders(
                array $providers,
                bool $skipWhenApiKeyMissing = true,
                bool $wrapTransaction = true,
            ): array {
                return ($this->callback)($providers);
            }
        };
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function createDtoRequest(array $payload): RequestInterface
    {
        $dispatched = new Dispatched([Dispatcher::FOUND, null, []]);

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn($payload);
        $request->expects($this->once())
            ->method('getAttribute')
            ->with(Dispatched::class)
            ->willReturn($dispatched);

        return $request;
    }

    private function createBodyRequest(string $body): RequestInterface
    {
        $stream = $this->createMock(StreamInterface::class);
        $stream->expects($this->once())
            ->method('getContents')
            ->willReturn($body);

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('getBody')
            ->willReturn($stream);

        return $request;
    }

    private function createAuthorization(string $organizationCode): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode($organizationCode);
        return $authorization;
    }

    private function setInjectedProperty(object $target, string $property, mixed $value): void
    {
        $reflectionProperty = new ReflectionProperty(BootstrapApi::class, $property);
        $reflectionProperty->setAccessible(true);
        $reflectionProperty->setValue($target, $value);
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrapSuccessResponse(array $response): array
    {
        $this->assertSame(1000, $response['code'] ?? null);
        $this->assertSame('ok', $response['message'] ?? null);
        $this->assertIsArray($response['data'] ?? null);
        return $response['data'];
    }

    private function assertErrorResponse(array $response, int $expectedCode, string $expectedMessageFragment): void
    {
        $this->assertSame($expectedCode, $response['code'] ?? null);
        $this->assertIsString($response['message'] ?? null);
        $this->assertStringContainsString($expectedMessageFragment, (string) $response['message']);
    }
}
