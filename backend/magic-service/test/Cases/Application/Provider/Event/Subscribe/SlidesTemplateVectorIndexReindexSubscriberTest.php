<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Event\Subscribe;

use App\Application\SlidesTemplate\Event\Subscribe\SlidesTemplateVectorIndexReindexSubscriber;
use App\Application\SlidesTemplate\Service\AdminSlidesTemplateAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Event\KnowledgeBaseEmbeddingModelUpdatedEvent;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 */
final class SlidesTemplateVectorIndexReindexSubscriberTest extends TestCase
{
    public function testEmbeddingModelChangeQueuesOfficialSlidesTemplateReindex(): void
    {
        $event = $this->event(true, true, 'old-model', 'new-model');
        $slidesTemplateAppService = $this->createMock(AdminSlidesTemplateAppService::class);
        $slidesTemplateAppService->expects(self::once())
            ->method('reindexOfficialVectorIndex')
            ->with(self::isInstanceOf(SlidesTemplateDataIsolation::class), true);

        $listener = new SlidesTemplateVectorIndexReindexSubscriber($slidesTemplateAppService, $this->loggerFactory());
        $listener->process($event);
    }

    public function testEnablingEmbeddingModelQueuesOfficialSlidesTemplateReindex(): void
    {
        $event = $this->event(false, true, 'same-model', 'same-model');
        $slidesTemplateAppService = $this->createMock(AdminSlidesTemplateAppService::class);
        $slidesTemplateAppService->expects(self::once())->method('reindexOfficialVectorIndex');

        $listener = new SlidesTemplateVectorIndexReindexSubscriber($slidesTemplateAppService, $this->loggerFactory());
        $listener->process($event);
    }

    public function testUnchangedEmbeddingModelDoesNotQueueSlidesTemplateReindex(): void
    {
        $event = $this->event(true, true, 'same-model', 'same-model');
        $slidesTemplateAppService = $this->createMock(AdminSlidesTemplateAppService::class);
        $slidesTemplateAppService->expects(self::never())->method('reindexOfficialVectorIndex');

        $listener = new SlidesTemplateVectorIndexReindexSubscriber($slidesTemplateAppService, $this->loggerFactory());
        $listener->process($event);
    }

    public function testDisablingEmbeddingModelDoesNotQueueSlidesTemplateReindex(): void
    {
        $event = $this->event(true, false, 'same-model', 'same-model');
        $slidesTemplateAppService = $this->createMock(AdminSlidesTemplateAppService::class);
        $slidesTemplateAppService->expects(self::never())->method('reindexOfficialVectorIndex');

        $listener = new SlidesTemplateVectorIndexReindexSubscriber($slidesTemplateAppService, $this->loggerFactory());
        $listener->process($event);
    }

    public function testNonOfficialOrganizationDoesNotQueueSlidesTemplateReindex(): void
    {
        $oldEntity = $this->ability(Status::Enabled, 'old-model');
        $newEntity = $this->ability(Status::Enabled, 'new-model');
        $newEntity->setOrganizationCode('OTHER_ORG');
        $event = new KnowledgeBaseEmbeddingModelUpdatedEvent($oldEntity, $newEntity);
        $slidesTemplateAppService = $this->createMock(AdminSlidesTemplateAppService::class);
        $slidesTemplateAppService->expects(self::never())->method('reindexOfficialVectorIndex');

        $listener = new SlidesTemplateVectorIndexReindexSubscriber($slidesTemplateAppService, $this->loggerFactory());
        $listener->process($event);
    }

    private function event(bool $oldEnabled, bool $newEnabled, string $oldModelId, string $newModelId): KnowledgeBaseEmbeddingModelUpdatedEvent
    {
        return new KnowledgeBaseEmbeddingModelUpdatedEvent(
            $this->ability($oldEnabled ? Status::Enabled : Status::Disabled, $oldModelId),
            $this->ability($newEnabled ? Status::Enabled : Status::Disabled, $newModelId),
        );
    }

    private function ability(Status $status, string $modelId): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $entity->setOrganizationCode(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $entity->setStatus($status);
        $entity->setConfig(['model_id' => $modelId]);
        return $entity;
    }

    private function loggerFactory(): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        return $loggerFactory;
    }
}
