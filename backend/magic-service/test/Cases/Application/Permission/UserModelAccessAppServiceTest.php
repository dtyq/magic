<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Permission\Service\UserModelAccessAppService;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
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
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $domainService->method('getUserSummary')->willReturn([
            'permission_control_status' => PermissionControlStatus::ENABLED,
            'roles' => [],
            'denied_model_ids' => ['model-b'],
            'accessible_model_ids' => ['model-a', 'model-c'],
        ]);

        $service = new UserModelAccessAppService($domainService);
        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('enabled', $context['permission_control_status']);
        $this->assertTrue($context['is_restricted']);
        $this->assertSame(['model-b'], $context['denied_model_ids']);
        $this->assertSame(['model-a', 'model-c'], $context['accessible_model_ids']);
        $this->assertSame(['model-a' => true, 'model-c' => true], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksDisabledStatusAsUnrestricted(): void
    {
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $domainService->method('getUserSummary')->willReturn([
            'permission_control_status' => PermissionControlStatus::DISABLED,
            'roles' => [],
            'denied_model_ids' => [],
            'accessible_model_ids' => ['model-a', 'model-b'],
        ]);

        $service = new UserModelAccessAppService($domainService);
        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('disabled', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame([], $context['denied_model_ids']);
        $this->assertSame(['model-a', 'model-b'], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testFilterModelEntriesUsesDenyUnionAccessibleSet(): void
    {
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $domainService->method('getUserSummary')->willReturn([
            'permission_control_status' => PermissionControlStatus::ENABLED,
            'roles' => [],
            'denied_model_ids' => ['model-a', 'model-c'],
            'accessible_model_ids' => ['model-b'],
        ]);

        $service = new UserModelAccessAppService($domainService);
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

    private function createAuthorization(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setOrganizationCode('org-1')
            ->setId('user-1');
    }
}
