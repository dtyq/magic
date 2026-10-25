<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMount;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountAuthorizer;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountGuard;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class ReferencedProjectMountGuardTest extends TestCase
{
    public function testAssertAllAccessibleAllowsAuthorizedMounts(): void
    {
        $authorizer = $this->createMock(ReferencedProjectMountAuthorizer::class);
        $authorizer->expects(self::once())->method('assertPublishedShareAccessible');

        $guard = new ReferencedProjectMountGuard($authorizer);
        $collaborationChecked = [];

        $guard->assertAllAccessible(
            [
                $this->mount('4001', ReferencedProjectAccessKind::PublishedShare, '3001'),
                $this->mount('4002', ReferencedProjectAccessKind::Collaboration),
            ],
            $this->createDataIsolation(),
            function (int $projectId) use (&$collaborationChecked): void {
                $collaborationChecked[] = $projectId;
            },
        );

        self::assertSame([4002], $collaborationChecked);
    }

    public function testAssertAllAccessibleRethrowsPublishedShareBusinessException(): void
    {
        $authorizer = $this->createMock(ReferencedProjectMountAuthorizer::class);
        $authorizer->method('assertPublishedShareAccessible')
            ->willThrowException(new BusinessException('share.permission_denied', ShareErrorCode::PERMISSION_DENIED->value));

        $guard = new ReferencedProjectMountGuard($authorizer);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ShareErrorCode::PERMISSION_DENIED->value);

        $guard->assertAllAccessible(
            [$this->mount('4001', ReferencedProjectAccessKind::PublishedShare, '3001')],
            $this->createDataIsolation(),
            function (int $projectId): void {
                self::fail('Collaboration check should not run for published-share mounts: ' . $projectId);
            },
        );
    }

    public function testAssertAllAccessibleCollapsesCollaborationDenial(): void
    {
        $authorizer = $this->createMock(ReferencedProjectMountAuthorizer::class);
        $authorizer->expects(self::never())->method('assertPublishedShareAccessible');

        $guard = new ReferencedProjectMountGuard($authorizer);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot mount referenced projects [4002]: access denied');

        $guard->assertAllAccessible(
            [$this->mount('4002', ReferencedProjectAccessKind::Collaboration)],
            $this->createDataIsolation(),
            function (): void {
                throw new BusinessException('project access denied', 51202);
            },
        );
    }

    public function testAssertAllAccessibleCollapsesCollaborationThrowable(): void
    {
        $guard = new ReferencedProjectMountGuard(
            $this->createMock(ReferencedProjectMountAuthorizer::class)
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Cannot mount referenced projects [4002]: access denied');

        $guard->assertAllAccessible(
            [$this->mount('4002', ReferencedProjectAccessKind::Collaboration)],
            $this->createDataIsolation(),
            function (): void {
                throw new RuntimeException('unexpected failure');
            },
        );
    }

    private function mount(
        string $projectId,
        ReferencedProjectAccessKind $accessKind,
        ?string $appId = null,
    ): ReferencedProjectMount {
        return new ReferencedProjectMount(
            projectId: $projectId,
            accessKind: $accessKind,
            sourceType: $accessKind === ReferencedProjectAccessKind::PublishedShare ? 'micro_app' : 'project',
            appId: $appId,
        );
    }

    private function createDataIsolation(): DataIsolation
    {
        $dataIsolation = $this->createMock(DataIsolation::class);
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org-1');

        return $dataIsolation;
    }
}
