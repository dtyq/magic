<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectCollaborationAccess;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMount;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountAuthorizer;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountGuard;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\Util\Locker\LockerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class ReferencedProjectMountServiceTest extends TestCase
{
    private MockObject&SandboxGatewayInterface $gateway;

    private MockObject&ReferencedProjectCollaborationAccess $collaboration;

    private MockObject&PublishedMicroAppFileAccessService $publication;

    private MockObject&ReferencedProjectMountAuthorizer $authorizer;

    private AgentDomainService&MockObject $agent;

    private LockerInterface&MockObject $locker;

    private DataIsolation&MockObject $identity;

    private ReferencedProjectMountService $service;

    private bool $lockHeld = false;

    protected function setUp(): void
    {
        $this->gateway = $this->createMock(SandboxGatewayInterface::class);
        $this->collaboration = $this->createMock(ReferencedProjectCollaborationAccess::class);
        $this->publication = $this->createMock(PublishedMicroAppFileAccessService::class);
        $this->authorizer = $this->createMock(ReferencedProjectMountAuthorizer::class);
        $this->agent = $this->createMock(AgentDomainService::class);
        $this->locker = $this->createMock(LockerInterface::class);
        $this->identity = $this->createMock(DataIsolation::class);
        $this->identity->method('getCurrentUserId')->willReturn('user-1');
        $this->identity->method('getCurrentOrganizationCode')->willReturn('org-1');
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('getProjectRootFileId')->willReturnCallback(static fn (int $id): int => $id + 1000);
        $this->service = new ReferencedProjectMountService(
            $this->gateway,
            $this->collaboration,
            $this->publication,
            new ReferencedProjectMountGuard($this->authorizer),
            $files,
            $this->agent,
            $this->locker,
        );
    }

    public function testNoMentionsRevokesExpiredPublicationRefreshesValidPublicationAndRetainsCollaboration(): void
    {
        $this->permitPreparation();
        $this->gateway->expects(self::exactly(2))->method('listReferencedProjects')
            ->willReturnOnConsecutiveCalls($this->listed('11', '12', '13'), $this->listed('13'));
        $this->collaboration->method('canAccess')->willReturnCallback(static fn (int $id): bool => $id === 13);
        $this->publication->method('canAccessProject')->willReturnCallback(static fn (int $id): bool => $id === 12);
        $removed = [];
        $this->gateway->expects(self::exactly(2))->method('unmountReferencedProject')
            ->willReturnCallback(static function ($identity, $sandbox, $id) use (&$removed): GatewayResult {
                $removed[] = $id;
                return GatewayResult::success();
            });
        $this->gateway->expects(self::once())->method('mountReferencedProject')
            ->with($this->identity, 'sandbox-1', '12', '1012')->willReturn(GatewayResult::success());
        $sent = false;
        $this->service->prepareAndSend($this->identity, 'sandbox-1', [], static fn (): bool => false, static function () use (&$sent): void {
            $sent = true;
        });
        self::assertTrue($sent);
        self::assertSame(['11', '12'], $removed);
    }

    public function testIdentityFailureBlocksAllFileOperationsAndSend(): void
    {
        $this->permitPreparation(false);
        $this->gateway->expects(self::never())->method('listReferencedProjects');
        $this->expectExceptionMessage('Cannot verify sandbox file access identity');
        $this->runBlocked();
    }

    #[DataProvider('invalidLists')]
    public function testListFailuresBlockSend(GatewayResult $result): void
    {
        $this->permitPreparation();
        $this->gateway->expects(self::once())->method('listReferencedProjects')->willReturn($result);
        $this->gateway->expects(self::never())->method('mountReferencedProject');
        $this->expectException(RuntimeException::class);
        $this->runBlocked();
    }

    public static function invalidLists(): array
    {
        return [
            [GatewayResult::error('offline')],
            [GatewayResult::success()],
            [GatewayResult::success(['referenced_projects' => ['bad-key' => ['project_id' => '1']]])],
            [GatewayResult::success(['referenced_projects' => [['project_id' => '../1']]])],
            [GatewayResult::success(['referenced_projects' => [['project_id' => '9223372036854775808']]])],
        ];
    }

    public function testUnmountFailureBlocksSend(): void
    {
        $this->permitPreparation();
        $this->gateway->method('listReferencedProjects')->willReturn($this->listed('11'));
        $this->gateway->expects(self::once())->method('unmountReferencedProject')->willReturn(GatewayResult::error('failed'));
        $this->gateway->expects(self::never())->method('mountReferencedProject');
        $this->expectExceptionMessage('Cannot remove referenced project 11');
        $this->runBlocked();
    }

    public function testSuccessfulUnmountMustBeConfirmedByList(): void
    {
        $this->permitPreparation();
        $this->gateway->method('listReferencedProjects')->willReturn($this->listed('11'));
        $this->gateway->method('unmountReferencedProject')->willReturn(GatewayResult::success());
        $this->gateway->expects(self::never())->method('mountReferencedProject');
        $this->expectExceptionMessage('Cannot confirm revoked references were removed');
        $this->runBlocked();
    }

    public function testAllNewTargetsAreAuthorizedBeforeAnyMount(): void
    {
        $this->permitPreparation();
        $this->gateway->method('listReferencedProjects')->willReturn($this->listed());
        $this->collaboration->method('canAccess')->willReturnCallback(static fn (int $id): bool => $id === 11);
        $this->gateway->expects(self::never())->method('mountReferencedProject');
        $this->expectExceptionMessage('access denied');
        $this->runBlocked([$this->mount('11'), $this->mount('12')]);
    }

    public function testPartialFailureCleansSuccessfulAndUncertainMountsButKeepsExistingCollaboration(): void
    {
        $this->permitPreparation();
        $this->gateway->expects(self::exactly(4))->method('listReferencedProjects')->willReturnOnConsecutiveCalls(
            $this->listed('13'),
            $this->listed('13'),
            $this->listed('11', '12', '13'),
            $this->listed('13'),
        );
        $this->collaboration->method('canAccess')->willReturn(true);
        $this->gateway->expects(self::exactly(2))->method('mountReferencedProject')->willReturnOnConsecutiveCalls(
            GatewayResult::success(),
            GatewayResult::error('timeout after mount'),
        );
        $removed = [];
        $this->gateway->expects(self::exactly(2))->method('unmountReferencedProject')
            ->willReturnCallback(static function ($identity, $sandbox, $id) use (&$removed): GatewayResult {
                $removed[] = $id;
                return GatewayResult::success();
            });
        try {
            $this->runBlocked([$this->mount('11'), $this->mount('12')]);
            self::fail('Mount failure must propagate');
        } catch (RuntimeException $error) {
            self::assertSame('Cannot mount referenced project 12', $error->getMessage());
            self::assertSame(['11', '12'], $removed);
        }
    }

    public function testCancellationAfterMountCleansReferencesWithoutSending(): void
    {
        $this->permitPreparation();
        $this->gateway->method('listReferencedProjects')->willReturnOnConsecutiveCalls(
            $this->listed(),
            $this->listed(),
            $this->listed('11'),
            $this->listed(),
        );
        $this->collaboration->method('canAccess')->willReturn(true);
        $this->gateway->expects(self::once())->method('mountReferencedProject')->willReturn(GatewayResult::success());
        $this->gateway->expects(self::once())->method('unmountReferencedProject')->with($this->identity, 'sandbox-1', '11')
            ->willReturn(GatewayResult::success());
        $checks = 0;
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [$this->mount('11')],
            static function () use (&$checks): bool { return ++$checks >= 3; },
            static function (): void { self::fail('Cancelled task cannot send'); },
        );
    }

    public function testCancelledBeforePreparationOnlyReleasesLock(): void
    {
        $this->permitLock();
        $this->agent->expects(self::never())->method('getWorkspaceStatus');
        $this->gateway->expects(self::never())->method('listReferencedProjects');
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [],
            static fn (): bool => true,
            static function (): void { self::fail('Cancelled task cannot send'); }
        );
    }

    public function testLockContentionBlocksPreparationWithoutReleasingAnotherOwnersLock(): void
    {
        $this->locker->expects(self::once())->method('mutexLock')->willReturn(false);
        $this->locker->expects(self::once())->method('spinLock')
            ->with('referenced-projects:sandbox-1', self::isType('string'), 3600, 1)->willReturn(false);
        $this->locker->expects(self::never())->method('release');
        $this->agent->expects(self::never())->method('getWorkspaceStatus');
        $this->gateway->expects(self::never())->method('listReferencedProjects');
        $checks = 0;
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [],
            static function () use (&$checks): bool { return ++$checks >= 2; },
            static function (): void { self::fail('Cancelled task cannot send'); }
        );
    }

    public function testPublishedMentionUsesPublicationGuardAndKeepsLockUntilSendReturns(): void
    {
        $this->permitPreparation();
        $this->gateway->method('listReferencedProjects')->willReturn($this->listed());
        $this->collaboration->expects(self::never())->method('canAccess');
        $mount = new ReferencedProjectMount('11', ReferencedProjectAccessKind::PublishedShare, 'micro_app', '21');
        $this->authorizer->expects(self::once())->method('assertPublishedShareAccessible')->with($mount, $this->identity);
        $this->gateway->expects(self::once())->method('mountReferencedProject')
            ->with($this->identity, 'sandbox-1', '11', '1011')->willReturn(GatewayResult::success());
        $sent = false;
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [$mount],
            static fn (): bool => false,
            function () use (&$sent): void {
                self::assertTrue($this->lockHeld, 'Reference preparation lock must cover the send operation');
                $sent = true;
            }
        );
        self::assertTrue($sent);
        self::assertFalse($this->lockHeld);
    }

    public function testSendFailureRetainsMountsBecauseAgentMayHaveAcceptedTask(): void
    {
        $this->permitPreparation();
        $this->gateway->expects(self::exactly(2))->method('listReferencedProjects')->willReturnOnConsecutiveCalls(
            $this->listed('13'),
            $this->listed('13'),
        );
        $this->collaboration->method('canAccess')->willReturn(true);
        $this->gateway->expects(self::once())->method('mountReferencedProject')->willReturn(GatewayResult::success());
        $this->gateway->expects(self::never())->method('unmountReferencedProject');
        $this->expectExceptionMessage('send failed');
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [$this->mount('11')],
            static fn (): bool => false,
            function (): void {
                self::assertTrue($this->lockHeld);
                throw new RuntimeException('send failed');
            }
        );
    }

    public function testMentionedCollaborationReferenceThatDisappearedIsMountedAgain(): void
    {
        $this->permitPreparation();
        $this->gateway->expects(self::exactly(2))->method('listReferencedProjects')->willReturnOnConsecutiveCalls(
            $this->listed('11'),
            $this->listed(),
        );
        $this->collaboration->method('canAccess')->willReturn(true);
        $this->gateway->expects(self::once())->method('mountReferencedProject')
            ->with($this->identity, 'sandbox-1', '11', '1011')->willReturn(GatewayResult::success());
        $this->gateway->expects(self::never())->method('unmountReferencedProject');
        $sent = false;
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            [$this->mount('11')],
            static fn (): bool => false,
            static function () use (&$sent): void { $sent = true; }
        );
        self::assertTrue($sent);
    }

    private function permitPreparation(bool $validIdentity = true): void
    {
        $this->permitLock();
        $this->agent->expects(self::once())->method('getWorkspaceStatus')->with($this->identity, 'sandbox-1')
            ->willReturn(new AgentResponse($validIdentity ? 1000 : 2000, 'status'));
    }

    private function permitLock(): void
    {
        $owner = null;
        $this->locker->expects(self::once())->method('mutexLock')
            ->willReturnCallback(function (string $name, string $actualOwner, int $ttl) use (&$owner): bool {
                self::assertSame('referenced-projects:sandbox-1', $name);
                self::assertGreaterThan(0, $ttl);
                self::assertNotSame('', $actualOwner);
                $owner = $actualOwner;
                $this->lockHeld = true;
                return true;
            });
        $this->locker->expects(self::once())->method('release')
            ->willReturnCallback(function (string $name, string $actualOwner) use (&$owner): bool {
                self::assertSame('referenced-projects:sandbox-1', $name);
                self::assertSame($owner, $actualOwner);
                $this->lockHeld = false;
                return true;
            });
    }

    private function listed(string ...$ids): GatewayResult
    {
        return GatewayResult::success(['referenced_projects' => array_map(static fn (string $id): array => ['project_id' => $id], $ids)]);
    }

    private function mount(string $id): ReferencedProjectMount
    {
        return new ReferencedProjectMount($id, ReferencedProjectAccessKind::Collaboration, 'project');
    }

    private function runBlocked(array $mounts = []): void
    {
        $this->service->prepareAndSend(
            $this->identity,
            'sandbox-1',
            $mounts,
            static fn (): bool => false,
            static function (): void { self::fail('Failed preparation cannot send'); }
        );
    }
}
