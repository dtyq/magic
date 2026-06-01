<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WarmPoolSandboxDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\BatchStatusResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Unit tests for {@see WarmPoolSandboxAppService::reconcileClaimedOrphans()}.
 *
 * Covers the "claimed in DB but pod already reaped by the gateway" path that
 * keeps stale `claimed` rows from piling up forever.
 *
 * @internal
 */
class WarmPoolSandboxAppServiceTest extends TestCase
{
    public function testReconcileReturnsEmptyWhenNoClaimedRows(): void
    {
        $domain = $this->createMock(WarmPoolSandboxDomainService::class);
        $domain->expects($this->once())
            ->method('listClaimedForReconcile')
            ->willReturn([]);
        $domain->expects($this->never())->method('deleteEntry');

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->never())->method('getBatchSandboxStatus');

        $service = $this->makeService($domain, $gateway);

        $result = $service->reconcileClaimedOrphans(50, 15);

        $this->assertSame(['scanned' => 0, 'reclaimed' => 0], $result);
    }

    public function testReconcileDeletesOnlyRowsGatewayReportsGone(): void
    {
        $running = $this->entity(101, 'running-sandbox');
        $gone = $this->entity(202, 'gone-sandbox');
        $exited = $this->entity(303, 'exited-sandbox');
        $unknown = $this->entity(404, 'unknown-sandbox');

        $domain = $this->createMock(WarmPoolSandboxDomainService::class);
        $domain->method('listClaimedForReconcile')
            ->willReturn([$running, $gone, $exited, $unknown]);
        // Only the two explicitly-gone pods are reclaimed; Running and an
        // absent/unknown status are left untouched.
        $deleted = [];
        $domain->method('deleteEntry')->willReturnCallback(function (int $id) use (&$deleted) {
            $deleted[] = $id;
        });

        $batch = $this->createMock(BatchStatusResult::class);
        $batch->method('isSuccess')->willReturn(true);
        $batch->method('getStatusMap')->willReturn([
            'running-sandbox' => SandboxStatus::RUNNING,
            'gone-sandbox' => SandboxStatus::NOT_FOUND,
            'exited-sandbox' => SandboxStatus::EXITED,
            // 'unknown-sandbox' deliberately absent -> inconclusive -> keep.
        ]);

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->once())
            ->method('getBatchSandboxStatus')
            ->with(['running-sandbox', 'gone-sandbox', 'exited-sandbox', 'unknown-sandbox'])
            ->willReturn($batch);

        $service = $this->makeService($domain, $gateway);

        $result = $service->reconcileClaimedOrphans(50, 15);

        $this->assertSame(['scanned' => 4, 'reclaimed' => 2], $result);
        $this->assertSame([202, 303], $deleted);
    }

    public function testReconcileSkipsWhenGatewayReturnsError(): void
    {
        $gone = $this->entity(202, 'gone-sandbox');

        $domain = $this->createMock(WarmPoolSandboxDomainService::class);
        $domain->method('listClaimedForReconcile')->willReturn([$gone]);
        // Gateway error is inconclusive: never delete, so active sessions are
        // never wiped by a flaky gateway.
        $domain->expects($this->never())->method('deleteEntry');

        $batch = $this->createMock(BatchStatusResult::class);
        $batch->method('isSuccess')->willReturn(false);
        $batch->method('getCode')->willReturn(500);
        $batch->method('getMessage')->willReturn('boom');

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('getBatchSandboxStatus')->willReturn($batch);

        $service = $this->makeService($domain, $gateway);

        $result = $service->reconcileClaimedOrphans(50, 15);

        $this->assertSame(1, $result['scanned']);
        $this->assertSame(0, $result['reclaimed']);
        $this->assertSame('gateway_error', $result['skipped']);
    }

    private function makeService(
        WarmPoolSandboxDomainService $domain,
        SandboxGatewayInterface $gateway
    ): WarmPoolSandboxAppService {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new WarmPoolSandboxAppService($domain, $gateway, $loggerFactory);
    }

    private function entity(int $id, string $sandboxId): WarmPoolSandboxEntity
    {
        $entity = new WarmPoolSandboxEntity();
        $entity->setId($id);
        $entity->setSandboxId($sandboxId);
        return $entity;
    }
}
