<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Event\Subscribe\ModelAuditReadyBridgeSubscriber;
use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\Provider\Service\ProviderModelDomainService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;

/**
 * @internal
 */
class ModelAuditReadyBridgeSubscriberTest extends TestCase
{
    public function testVideoGeneratedUsageIncludesHasAudioOutput(): void
    {
        $repository = new RecordingAuditLogRepository();
        $subscriber = new ModelAuditReadyBridgeSubscriber(
            new ModelCallAuditDomainService($repository),
            (new ReflectionClass(ProviderModelDomainService::class))->newInstanceWithoutConstructor(),
            new NullLogger(),
        );
        $event = new VideoGeneratedEvent();
        $event->setOrganizationCode('org-1');
        $event->setUserId('user-1');
        $event->setModel('keling-video');
        $event->setOriginalModelId('keling-video');
        $event->setProviderModelId('provider-model');
        $event->setDurationSeconds(5);
        $event->setHasAudioOutput(false);
        $event->setBusinessParams([
            'event_id' => '10001',
            'model_id' => 'keling-video',
            'request_id' => 'request-1',
        ]);

        $subscriber->process($event);

        $this->assertCount(1, $repository->entities);
        $this->assertFalse($repository->entities[0]->getUsage()['has_audio_output']);
    }
}

final class RecordingAuditLogRepository implements AuditLogRepositoryInterface
{
    /** @var list<AuditLogEntity> */
    public array $entities = [];

    public function create(AuditLogEntity $entity): void
    {
        $this->entities[] = $entity;
    }

    public function createOrUpdateAuditByEventId(AuditLogEntity $entity): void
    {
        $this->entities[] = $entity;
    }

    public function recordPointsByEventId(string $eventId, int $points): void
    {
    }

    public function queries(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array {
        return ['list' => [], 'next_cursor_id' => null, 'prev_cursor_id' => null, 'has_more' => false];
    }

    public function statistics(array $filters, string $currentOrganizationCode, bool $isOfficialOrganization): array
    {
        return ['summary' => [], 'trend' => [], 'breakdown' => []];
    }
}
