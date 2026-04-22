<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Permission\Service\UserModelAccessAppService;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class UserModelAccessAppServiceTest extends TestCase
{
    public function testResolveAccessContextMarksEnabledStatusAsRestricted(): void
    {
        $domainService = $this->createDomainService(
            new ModelAccessContext(PermissionControlStatus::ENABLED, ['model-b'], ['model-a', 'model-c'])
        );

        $service = $this->createService($domainService);
        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('enabled', $context['permission_control_status']);
        $this->assertTrue($context['is_restricted']);
        $this->assertSame(['model-b'], $context['denied_model_ids']);
        $this->assertSame(['model-a', 'model-c'], $context['accessible_model_ids']);
        $this->assertSame(['model-a' => true, 'model-c' => true], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksDisabledStatusAsUnrestricted(): void
    {
        $domainService = $this->createDomainService(
            new ModelAccessContext(PermissionControlStatus::DISABLED, [], ['model-a', 'model-b'])
        );

        $service = $this->createService($domainService);
        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('disabled', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame([], $context['denied_model_ids']);
        $this->assertSame(['model-a', 'model-b'], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testFilterModelEntriesUsesDenyUnionAccessibleSet(): void
    {
        $domainService = $this->createDomainService(
            new ModelAccessContext(PermissionControlStatus::ENABLED, ['model-a', 'model-c'], ['model-b'])
        );

        $service = $this->createService($domainService);
        $filtered = $service->filterModelEntries(
            $this->createAuthorization(),
            [
                ['model_id' => 'model-a'],
                ['model_id' => 'model-b'],
                ['model_id' => 'model-c'],
            ],
            static fn (array $item): string => $item['model_id']
        );

        $this->assertSame([['model_id' => 'model-b']], $filtered);
    }

    public function testResolveAccessContextUsesDomainSummaryAfterRoleExclusionsApplied(): void
    {
        $domainService = $this->createDomainService(
            new ModelAccessContext(PermissionControlStatus::ENABLED, ['model-b'], ['model-a'])
        );

        $service = $this->createService($domainService);
        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame(['model-b'], $context['denied_model_ids']);
        $this->assertSame(['model-a' => true], $context['accessible_model_id_map']);
    }

    private function createAuthorization(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setOrganizationCode('org-1')
            ->setId('user-1');
    }

    private function createService(ModelAccessRoleDomainService $domainService): UserModelAccessAppService
    {
        $permissionDataIsolation = $this->getMockBuilder(PermissionDataIsolation::class)
            ->disableOriginalConstructor()
            ->getMock();

        return new class($domainService, $permissionDataIsolation) extends UserModelAccessAppService {
            public function __construct(
                ModelAccessRoleDomainService $domainService,
                private PermissionDataIsolation $permissionDataIsolation
            ) {
                parent::__construct($domainService);
            }

            protected function createPermissionDataIsolation(MagicUserAuthorization $authorization): PermissionDataIsolation
            {
                return $this->permissionDataIsolation;
            }
        };
    }

    private function createDomainService(ModelAccessContext $context): ModelAccessRoleDomainService
    {
        return new readonly class($context) extends ModelAccessRoleDomainService {
            public function __construct(private ModelAccessContext $context)
            {
            }

            public function resolveAccessContext(
                PermissionDataIsolation $dataIsolation,
                string $userId
            ): ModelAccessContext {
                return $this->context;
            }
        };
    }
}
