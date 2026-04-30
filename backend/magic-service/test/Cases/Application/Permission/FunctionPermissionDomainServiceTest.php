<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Admin\Service\AdminGlobalSettingsDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Permission\Entity\FunctionPermissionPolicyEntity;
use App\Domain\Permission\Entity\ValueObject\BindingScopeType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\FunctionPermissionPolicyRepository;
use App\Domain\Permission\Service\FunctionPermissionDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use Closure;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class FunctionPermissionDomainServiceTest extends TestCase
{
    public function testUpdatePolicyEnabledCreatesPolicyWithDefaultBindingScopeWhenMissing(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createUnusedSettingsService();
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn(null);
        $repository->expects($this->once())
            ->method('save')
            ->with($this->callback(function (FunctionPermissionPolicyEntity $entity): bool {
                return $entity->getOrganizationCode() === 'ORG_ENABLED'
                    && $entity->getFunctionCode() === 'skill.create'
                    && $entity->getEnabled()
                    && $entity->getBindingScope() === ['type' => BindingScopeType::OrganizationAll->value]
                    && $entity->getRemark() === null;
            }))
            ->willReturn($this->createPolicy('ORG_ENABLED', 'skill.create', true, ['type' => BindingScopeType::OrganizationAll->value]));

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);
        $dataIsolation = $this->createPermissionDataIsolation('ORG_ENABLED', 'operator');

        $saved = $service->updatePolicyEnabled(
            $dataIsolation,
            'skill.create',
            true,
            ['type' => BindingScopeType::OrganizationAll->value]
        );

        $this->assertTrue($saved->getEnabled());
        $this->assertSame(['type' => BindingScopeType::OrganizationAll->value], $saved->getBindingScope());
    }

    public function testUpdatePolicyEnabledReturnsDefaultDisabledPolicyWithoutSavingWhenMissing(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createUnusedSettingsService();
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn(null);
        $repository->expects($this->never())->method('save');
        $repository->expects($this->never())->method('updateEnabled');

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);
        $dataIsolation = $this->createPermissionDataIsolation('ORG_ENABLED', 'operator');

        $saved = $service->updatePolicyEnabled(
            $dataIsolation,
            'skill.create',
            false,
            ['type' => BindingScopeType::OrganizationAll->value]
        );

        $this->assertSame('ORG_ENABLED', $saved->getOrganizationCode());
        $this->assertSame('skill.create', $saved->getFunctionCode());
        $this->assertFalse($saved->getEnabled());
        $this->assertSame(['type' => BindingScopeType::OrganizationAll->value], $saved->getBindingScope());
        $this->assertNull($saved->getRemark());
    }

    public function testUpdatePolicyEnabledNormalizesAndPersistsExistingEmptyBindingScopeWhenEnabling(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createUnusedSettingsService();
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );
        $existing = $this->createPolicy('ORG_ENABLED', 'skill.create', false, []);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($existing);
        $repository->expects($this->once())
            ->method('save')
            ->with($this->callback(function (FunctionPermissionPolicyEntity $entity): bool {
                return $entity->getOrganizationCode() === 'ORG_ENABLED'
                    && $entity->getFunctionCode() === 'skill.create'
                    && $entity->getEnabled()
                    && $entity->getBindingScope() === ['type' => BindingScopeType::OrganizationAll->value];
            }))
            ->willReturn($this->createPolicy('ORG_ENABLED', 'skill.create', true, ['type' => BindingScopeType::OrganizationAll->value]));
        $repository->expects($this->never())->method('updateEnabled');

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);
        $dataIsolation = $this->createPermissionDataIsolation('ORG_ENABLED', 'operator');

        $saved = $service->updatePolicyEnabled(
            $dataIsolation,
            'skill.create',
            true,
            ['type' => BindingScopeType::OrganizationAll->value]
        );

        $this->assertTrue($saved->getEnabled());
        $this->assertSame(['type' => BindingScopeType::OrganizationAll->value], $saved->getBindingScope());
    }

    public function testUpdatePolicyEnabledDisablesExistingPolicyWithoutRevalidatingInvalidBindingScope(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createUnusedSettingsService();
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );
        $existing = $this->createPolicy('ORG_ENABLED', 'skill.create', true, [
            'type' => BindingScopeType::Specific->value,
            'user_ids' => [],
            'department_ids' => [],
        ]);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($existing);
        $repository->expects($this->once())
            ->method('updateEnabled')
            ->with('ORG_ENABLED', 'skill.create', false)
            ->willReturn($this->createPolicy('ORG_ENABLED', 'skill.create', false, $existing->getBindingScope()));
        $repository->expects($this->never())->method('save');

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);
        $dataIsolation = $this->createPermissionDataIsolation('ORG_ENABLED', 'operator');

        $saved = $service->updatePolicyEnabled(
            $dataIsolation,
            'skill.create',
            false,
            ['type' => BindingScopeType::OrganizationAll->value]
        );

        $this->assertFalse($saved->getEnabled());
        $this->assertSame($existing->getBindingScope(), $saved->getBindingScope());
    }

    public function testUpdatePolicyEnabledRejectsEnablingExistingPolicyWithInvalidBindingScope(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createUnusedSettingsService();
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );
        $existing = $this->createPolicy('ORG_ENABLED', 'skill.create', false, [
            'type' => BindingScopeType::Specific->value,
            'user_ids' => [],
            'department_ids' => [],
        ]);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($existing);
        $repository->expects($this->never())->method('updateEnabled');
        $repository->expects($this->never())->method('save');

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);
        $dataIsolation = $this->createPermissionDataIsolation('ORG_ENABLED', 'operator');

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('current binding_scope is invalid, please use full save api');

        $service->updatePolicyEnabled(
            $dataIsolation,
            'skill.create',
            true,
            ['type' => BindingScopeType::OrganizationAll->value]
        );
    }

    public function testCheckPermissionReturnsTrueWithoutPolicyLookupWhenPermissionControlDisabled(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createSettingsService(AdminGlobalSettingsStatus::DISABLED);
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );

        $repository->expects($this->never())->method('getByFunctionCode');

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);

        $allowed = $service->checkPermission(
            PermissionDataIsolation::create('ORG_DISABLED', 'operator'),
            'user-1',
            'skill.create'
        );

        $this->assertTrue($allowed);
    }

    public function testCheckPermissionReturnsTrueWithoutDepartmentLookupWhenSpecificPolicyMatchesUser(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createSettingsService(AdminGlobalSettingsStatus::ENABLED);
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );
        $policy = $this->createSpecificPolicy(['user-1'], ['dep-1']);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($policy);

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);

        $allowed = $service->checkPermission(
            PermissionDataIsolation::create('ORG_ENABLED', 'operator'),
            'user-1',
            'skill.create'
        );

        $this->assertTrue($allowed);
    }

    public function testCheckPermissionQueriesDepartmentsOnlyWhenSpecificPolicyNeedsDepartmentFallback(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createSettingsService(AdminGlobalSettingsStatus::ENABLED);
        $departmentUserCalls = 0;
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (ContactDataIsolation $dataIsolation, string $userId, bool $withAllParentIds) use (&$departmentUserCalls): array {
                ++$departmentUserCalls;
                if (
                    $dataIsolation->getCurrentOrganizationCode() !== 'ORG_ENABLED'
                    || $dataIsolation->getCurrentUserId() !== 'operator'
                    || $userId !== 'user-1'
                    || ! $withAllParentIds
                ) {
                    throw new RuntimeException('Unexpected getDepartmentIdsByUserId arguments');
                }

                return ['dep-2', 'dep-3'];
            }
        );
        $policy = $this->createSpecificPolicy(['other-user'], ['dep-2']);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($policy);

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);

        $allowed = $service->checkPermission(
            PermissionDataIsolation::create('ORG_ENABLED', 'operator'),
            'user-1',
            'skill.create'
        );

        $this->assertTrue($allowed);
        $this->assertSame(1, $departmentUserCalls);
    }

    public function testCheckPermissionReturnsFalseWithoutDepartmentLookupWhenSpecificPolicyHasNoDepartmentFallback(): void
    {
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $settingsService = $this->createSettingsService(AdminGlobalSettingsStatus::ENABLED);
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called');
            }
        );
        $policy = $this->createSpecificPolicy(['other-user'], []);

        $repository->expects($this->once())
            ->method('getByFunctionCode')
            ->with($this->isInstanceOf(PermissionDataIsolation::class), 'skill.create')
            ->willReturn($policy);

        $service = new FunctionPermissionDomainService($repository, $settingsService, $departmentUserDomainService);

        $allowed = $service->checkPermission(
            PermissionDataIsolation::create('ORG_ENABLED', 'operator'),
            'user-1',
            'skill.create'
        );

        $this->assertFalse($allowed);
    }

    private function createSettingsService(AdminGlobalSettingsStatus $status): AdminGlobalSettingsDomainService
    {
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $settingsRepository->expects($this->once())
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::FUNCTION_PERMISSION_CONTROL, $this->isType('string'))
            ->willReturn(
                (new AdminGlobalSettingsEntity())
                    ->setType(AdminGlobalSettingsType::FUNCTION_PERMISSION_CONTROL)
                    ->setOrganization('ORG')
                    ->setStatus($status)
            );

        return new AdminGlobalSettingsDomainService($settingsRepository);
    }

    private function createUnusedSettingsService(): AdminGlobalSettingsDomainService
    {
        return new AdminGlobalSettingsDomainService($this->createStub(AdminGlobalSettingsRepositoryInterface::class));
    }

    /**
     * @param list<string> $userIds
     * @param list<string> $departmentIds
     */
    private function createSpecificPolicy(array $userIds, array $departmentIds): FunctionPermissionPolicyEntity
    {
        $policy = new FunctionPermissionPolicyEntity();
        $policy->setFunctionCode('skill.create');
        $policy->setEnabled(true);
        $policy->setBindingScope([
            'type' => BindingScopeType::Specific->value,
            'user_ids' => $userIds,
            'department_ids' => $departmentIds,
        ]);

        return $policy;
    }

    private function createPolicy(
        string $organizationCode,
        string $functionCode,
        bool $enabled,
        array $bindingScope
    ): FunctionPermissionPolicyEntity {
        $policy = new FunctionPermissionPolicyEntity();
        $policy->setOrganizationCode($organizationCode);
        $policy->setFunctionCode($functionCode);
        $policy->setEnabled($enabled);
        $policy->setBindingScope($bindingScope);

        return $policy;
    }

    private function createPermissionDataIsolation(string $organizationCode, string $userId): PermissionDataIsolation
    {
        $dataIsolation = $this->createMock(PermissionDataIsolation::class);
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn($organizationCode);
        $dataIsolation->method('getCurrentUserId')->willReturn($userId);
        $dataIsolation->method('getMagicId')->willReturn('');

        return $dataIsolation;
    }

    private function createDepartmentUserDomainService(Closure $resolver): MagicDepartmentUserDomainService
    {
        return new readonly class($resolver) extends MagicDepartmentUserDomainService {
            public function __construct(private Closure $resolver)
            {
            }

            public function getDepartmentIdsByUserId(
                ContactDataIsolation $dataIsolation,
                string $userId,
                bool $withAllParentIds = false
            ): array {
                return ($this->resolver)($dataIsolation, $userId, $withAllParentIds);
            }
        };
    }
}
