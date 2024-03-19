<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Bootstrap;

use App\Application\Bootstrap\Service\BootstrapInitializationAppService;
use App\Application\Bootstrap\Service\Initializer\AccountInitializer;
use App\Application\Bootstrap\Service\Initializer\OrganizationInitializer;
use App\Application\Bootstrap\Service\Initializer\PermissionInitializer;
use App\Application\Bootstrap\Service\Initializer\PlatformSettingInitializer;
use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Application\Mode\Service\AdminModeAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;

/**
 * @internal
 */
class BootstrapInitializationAppServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testInitializeReturnsFourModulePayload(): void
    {
        $locker = Mockery::mock(LockerInterface::class);
        $organizationInitializer = Mockery::mock(OrganizationInitializer::class);
        $accountInitializer = Mockery::mock(AccountInitializer::class);
        $permissionInitializer = Mockery::mock(PermissionInitializer::class);
        $platformSettingInitializer = Mockery::mock(PlatformSettingInitializer::class);
        $magicSettingAppService = Mockery::mock(MagicSettingAppService::class);

        $locker->shouldReceive('mutexLock')
            ->once()
            ->with('bootstrap:execute:Magic', 'fixed-owner', 30)
            ->andReturn(true);
        $locker->shouldReceive('release')
            ->once()
            ->with('bootstrap:execute:Magic', 'fixed-owner')
            ->andReturn(true);

        $organizationInitializer->shouldReceive('initialize')
            ->once()
            ->with('Magic', ['zh_CN' => '官方组织', 'en_US' => 'Official Organization'])
            ->andReturn([
                'success' => true,
                'organization_code' => 'Magic',
                'organization_name' => '官方组织',
                'organization_name_i18n' => ['zh_CN' => '官方组织', 'en_US' => 'Official Organization'],
                'login_code' => '123456',
                'root_department_id' => '-1',
                'is_idempotent_replay' => false,
            ]);

        $accountInitializer->shouldReceive('initialize')
            ->once()
            ->with('Magic', '13800000000', 'ChangeMe123!', '-1')
            ->andReturn([
                'success' => true,
                'admin_magic_id' => 'm_001',
                'admin_user_id' => 'u_001',
                'is_idempotent_replay' => false,
            ]);

        $permissionInitializer->shouldReceive('initialize')
            ->once()
            ->with('Magic', 'u_001', 'm_001')
            ->andReturn([
                'success' => true,
                'organization_admin_role' => 'ORGANIZATION_ADMIN',
                'permission_group' => 'MAGIC_PLATFORM_PERMISSIONS',
                'is_idempotent_replay' => false,
            ]);

        $platformSettingInitializer->shouldReceive('initialize')
            ->once()
            ->with(
                ['name' => '超级助手', 'description' => '帮助你完成日常工作'],
                '超级助手',
                '帮助你完成日常工作'
            )
            ->andReturn([
                'success' => true,
                'language' => 'zh_CN',
                'is_skipped' => false,
                'is_idempotent_replay' => false,
            ]);

        $globalConfig = new GlobalConfig();
        $magicSettingAppService->shouldReceive('get')
            ->once()
            ->andReturn($globalConfig);
        $magicSettingAppService->shouldReceive('save')
            ->once()
            ->with(Mockery::on(static function ($config): bool {
                return $config instanceof GlobalConfig && $config->isNeedInitial() === false;
            }))
            ->andReturnUsing(static fn (GlobalConfig $config) => $config);

        $service = $this->makeService(
            $locker,
            $organizationInitializer,
            $accountInitializer,
            $permissionInitializer,
            $platformSettingInitializer,
            $magicSettingAppService
        );

        $dto = new BootstrapExecuteRequestDTO([
            'admin_account' => [
                'phone' => '13800000000',
                'password' => 'ChangeMe123!',
            ],
            'agent_info' => [
                'name' => '超级助手',
                'description' => '帮助你完成日常工作',
            ],
        ]);

        $result = $service->initialize($dto);

        $this->assertTrue($result['success']);
        $this->assertArrayHasKey('initialization', $result);
        $this->assertArrayHasKey('organization', $result['initialization']);
        $this->assertArrayHasKey('account', $result['initialization']);
        $this->assertArrayHasKey('permission', $result['initialization']);
        $this->assertArrayHasKey('platform_setting', $result['initialization']);
        $this->assertArrayHasKey('service_provider', $result['initialization']);
        $this->assertSame('Magic', $result['initialization']['organization']['organization_code']);
        $this->assertArrayNotHasKey('root_department_id', $result['initialization']['organization']);
        $this->assertSame('u_001', $result['initialization']['account']['admin_user_id']);
        $this->assertSame('MAGIC_PLATFORM_PERMISSIONS', $result['initialization']['permission']['permission_group']);
        $this->assertSame('zh_CN', $result['initialization']['platform_setting']['language']);
    }

    public function testInitializeUsesServiceProviderModelParametersWhenSavingProviderModel(): void
    {
        $locker = Mockery::mock(LockerInterface::class);
        $organizationInitializer = Mockery::mock(OrganizationInitializer::class);
        $accountInitializer = Mockery::mock(AccountInitializer::class);
        $permissionInitializer = Mockery::mock(PermissionInitializer::class);
        $platformSettingInitializer = Mockery::mock(PlatformSettingInitializer::class);
        $magicSettingAppService = Mockery::mock(MagicSettingAppService::class);
        $adminProviderAppService = Mockery::mock(AdminProviderAppService::class);

        $locker->shouldReceive('mutexLock')
            ->once()
            ->with('bootstrap:execute:Magic', 'fixed-owner', 30)
            ->andReturn(true);
        $locker->shouldReceive('release')
            ->once()
            ->with('bootstrap:execute:Magic', 'fixed-owner')
            ->andReturn(true);

        $organizationInitializer->shouldReceive('initialize')
            ->once()
            ->andReturn([
                'success' => true,
                'organization_code' => 'Magic',
                'root_department_id' => '-1',
            ]);

        $accountInitializer->shouldReceive('initialize')
            ->once()
            ->andReturn([
                'success' => true,
                'admin_magic_id' => 'm_001',
                'admin_user_id' => 'u_001',
            ]);

        $permissionInitializer->shouldReceive('initialize')
            ->once()
            ->andReturn([
                'success' => true,
                'permission_group' => 'MAGIC_PLATFORM_PERMISSIONS',
            ]);

        $platformSettingInitializer->shouldReceive('initialize')
            ->once()
            ->with([], '', '')
            ->andReturn([
                'success' => true,
                'language' => 'zh_CN',
            ]);

        $globalConfig = new GlobalConfig();
        $magicSettingAppService->shouldReceive('get')
            ->once()
            ->andReturn($globalConfig);
        $magicSettingAppService->shouldReceive('save')
            ->once()
            ->with(Mockery::on(static function ($config): bool {
                return $config instanceof GlobalConfig && $config->isNeedInitial() === false;
            }))
            ->andReturnUsing(static fn (GlobalConfig $config) => $config);

        $adminProviderAppService->shouldReceive('saveModel')
            ->once()
            ->with(
                Mockery::on(static function ($authorization): bool {
                    return $authorization instanceof MagicUserAuthorization
                        && $authorization->getId() === 'system'
                        && $authorization->getOrganizationCode() === 'Magic';
                }),
                Mockery::on(static function ($dto): bool {
                    return $dto->getModelType()?->value === 1
                        && $dto->getCategory()?->value === 'vlm';
                })
            )
            ->andReturn([
                'id' => 'pm_001',
                'model_id' => 'image-model-v1',
            ]);

        $service = new class($locker, $organizationInitializer, $accountInitializer, $permissionInitializer, make(AdminProviderDomainService::class), make(ProviderConfigDomainService::class), $adminProviderAppService, make(EventDispatcherInterface::class), make(AdminModeAppService::class), $platformSettingInitializer, $magicSettingAppService) extends BootstrapInitializationAppService {
            protected function initServiceProvider(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function initMode(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function initAiAbility(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function createOfficialAgents(string $userId, array $agentCodes = []): array
            {
                return ['success' => true, 'success_count' => 0, 'skip_count' => 0, 'fail_count' => 0];
            }

            protected function initAccessToken(?string $apiKey = null): array
            {
                return ['success' => true];
            }

            protected function getOfficeOrganizationCode(): string
            {
                return 'Magic';
            }

            protected function getOfficeOrganizationNameI18n(): array
            {
                return [
                    'zh_CN' => '官方组织',
                    'en_US' => 'Official Organization',
                ];
            }

            protected function generateLockOwner(): string
            {
                return 'fixed-owner';
            }

            protected function runInTransaction(callable $callback): mixed
            {
                return $callback();
            }

            protected function createProviderConfigEntity(
                ConnectivityTestByConfigRequest $serviceProviderModel,
                string $organizationCode
            ): ProviderConfigEntity {
                $entity = new ProviderConfigEntity();
                $entity->setId(1001);
                return $entity;
            }

            protected function addModelToDefaultModeGroup(
                MagicUserAuthorization $authorization,
                ConnectivityTestByConfigRequest $serviceProviderModel,
                null|int|string $providerModelId,
                string $modelId
            ): ?string {
                return 'group_001';
            }
        };

        $dto = new BootstrapExecuteRequestDTO([
            'admin_account' => [
                'phone' => '13800000000',
                'password' => 'ChangeMe123!',
            ],
            'service_provider_model' => [
                'provider_code' => 'openai',
                'model_version' => 'image-model-v1',
                'category' => 'vlm',
                'model_type' => 1,
                'service_provider_config' => [
                    'api_key' => 'test-key',
                ],
            ],
        ]);

        $result = $service->initialize($dto);

        $this->assertTrue($result['success']);
        $this->assertSame('pm_001', $result['initialization']['llm']['model_id']);
        $this->assertSame('group_001', $result['initialization']['llm']['mode_group_id']);
    }

    public function testInitializeThrowsTooManyRequestsWhenLockFailed(): void
    {
        $locker = Mockery::mock(LockerInterface::class);
        $organizationInitializer = Mockery::mock(OrganizationInitializer::class);
        $accountInitializer = Mockery::mock(AccountInitializer::class);
        $permissionInitializer = Mockery::mock(PermissionInitializer::class);
        $platformSettingInitializer = Mockery::mock(PlatformSettingInitializer::class);
        $magicSettingAppService = Mockery::mock(MagicSettingAppService::class);

        $locker->shouldReceive('mutexLock')
            ->once()
            ->with('bootstrap:execute:Magic', 'fixed-owner', 30)
            ->andReturn(false);
        $locker->shouldReceive('release')->never();
        $platformSettingInitializer->shouldReceive('initialize')->never();
        $magicSettingAppService->shouldReceive('get')->never();
        $magicSettingAppService->shouldReceive('save')->never();

        $service = $this->makeService(
            $locker,
            $organizationInitializer,
            $accountInitializer,
            $permissionInitializer,
            $platformSettingInitializer,
            $magicSettingAppService
        );

        $dto = new BootstrapExecuteRequestDTO([
            'admin_account' => [
                'phone' => '13800000000',
                'password' => 'ChangeMe123!',
            ],
        ]);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(5007);
        $service->initialize($dto);
    }

    public function testInitializeThrowsWhenOfficeOrganizationIsEmpty(): void
    {
        $locker = Mockery::mock(LockerInterface::class);
        $organizationInitializer = Mockery::mock(OrganizationInitializer::class);
        $accountInitializer = Mockery::mock(AccountInitializer::class);
        $permissionInitializer = Mockery::mock(PermissionInitializer::class);
        $platformSettingInitializer = Mockery::mock(PlatformSettingInitializer::class);
        $magicSettingAppService = Mockery::mock(MagicSettingAppService::class);
        $locker->shouldReceive('mutexLock')->never();
        $platformSettingInitializer->shouldReceive('initialize')->never();
        $magicSettingAppService->shouldReceive('get')->never();
        $magicSettingAppService->shouldReceive('save')->never();

        $service = $this->makeService(
            $locker,
            $organizationInitializer,
            $accountInitializer,
            $permissionInitializer,
            $platformSettingInitializer,
            $magicSettingAppService,
            ''
        );

        $dto = new BootstrapExecuteRequestDTO([
            'admin_account' => [
                'phone' => '13800000000',
                'password' => 'ChangeMe123!',
            ],
        ]);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(5003);
        $service->initialize($dto);
    }

    /**
     * @param LockerInterface&MockInterface $locker
     * @param MockInterface&OrganizationInitializer $organizationInitializer
     * @param AccountInitializer&MockInterface $accountInitializer
     * @param MockInterface&PermissionInitializer $permissionInitializer
     * @param MockInterface&PlatformSettingInitializer $platformSettingInitializer
     * @param MagicSettingAppService&MockInterface $magicSettingAppService
     */
    private function makeService(
        LockerInterface $locker,
        OrganizationInitializer $organizationInitializer,
        AccountInitializer $accountInitializer,
        PermissionInitializer $permissionInitializer,
        PlatformSettingInitializer $platformSettingInitializer,
        MagicSettingAppService $magicSettingAppService,
        string $officeOrganizationCode = 'Magic'
    ): BootstrapInitializationAppService {
        $adminProviderDomainService = make(AdminProviderDomainService::class);
        $providerConfigDomainService = make(ProviderConfigDomainService::class);
        $adminProviderAppService = make(AdminProviderAppService::class);
        $eventDispatcher = make(EventDispatcherInterface::class);
        $adminModeAppService = make(AdminModeAppService::class);

        return new class($locker, $organizationInitializer, $accountInitializer, $permissionInitializer, $adminProviderDomainService, $providerConfigDomainService, $adminProviderAppService, $eventDispatcher, $adminModeAppService, $platformSettingInitializer, $magicSettingAppService, $officeOrganizationCode) extends BootstrapInitializationAppService {
            public function __construct(
                LockerInterface $locker,
                OrganizationInitializer $organizationInitializer,
                AccountInitializer $accountInitializer,
                PermissionInitializer $permissionInitializer,
                AdminProviderDomainService $adminProviderDomainService,
                ProviderConfigDomainService $providerConfigDomainService,
                AdminProviderAppService $adminProviderAppService,
                EventDispatcherInterface $eventDispatcher,
                AdminModeAppService $adminModeAppService,
                PlatformSettingInitializer $platformSettingInitializer,
                MagicSettingAppService $magicSettingAppService,
                private readonly string $officeOrganizationCode
            ) {
                parent::__construct(
                    $locker,
                    $organizationInitializer,
                    $accountInitializer,
                    $permissionInitializer,
                    $adminProviderDomainService,
                    $providerConfigDomainService,
                    $adminProviderAppService,
                    $eventDispatcher,
                    $adminModeAppService,
                    $platformSettingInitializer,
                    $magicSettingAppService
                );
            }

            protected function initServiceProvider(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function initMode(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function initAiAbility(): array
            {
                return ['success' => true, 'count' => 0];
            }

            protected function createOfficialAgents(string $userId, array $agentCodes = []): array
            {
                return ['success' => true, 'success_count' => 0, 'skip_count' => 0, 'fail_count' => 0];
            }

            protected function initAccessToken(?string $apiKey = null): array
            {
                return ['success' => true];
            }

            protected function getOfficeOrganizationCode(): string
            {
                return $this->officeOrganizationCode;
            }

            protected function getOfficeOrganizationNameI18n(): array
            {
                return [
                    'zh_CN' => '官方组织',
                    'en_US' => 'Official Organization',
                ];
            }

            protected function generateLockOwner(): string
            {
                return 'fixed-owner';
            }

            protected function runInTransaction(callable $callback): mixed
            {
                return $callback();
            }
        };
    }
}
