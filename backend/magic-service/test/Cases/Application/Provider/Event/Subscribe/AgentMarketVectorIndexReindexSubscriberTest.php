<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Event\Subscribe;

use App\Application\SuperMagic\Agent\Event\Subscribe\AgentMarketVectorIndexReindexSubscriber;
use App\Application\SuperMagic\Agent\Service\AdminSuperMagicAgentAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Event\AiAbilityUpdatedEvent;
use App\Domain\SuperMagic\Agent\Service\AgentMarketVectorIndexDomainService;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 */
final class AgentMarketVectorIndexReindexSubscriberTest extends TestCase
{
    public function testEmbeddingModelChangeDelegatesFullReindexToAgentAppService(): void
    {
        $oldEntity = $this->ability(Status::Enabled, 'old-model');
        $newEntity = $this->ability(Status::Enabled, 'new-model');
        $appService = $this->createMock(AdminSuperMagicAgentAppService::class);
        $appService->expects(self::once())
            ->method('reindexAllMarketVectors')
            ->with($newEntity->getOrganizationCode(), 'system', forceReEmbedding: true)
            ->willReturn(['queued' => 0]);
        $domainService = $this->createMock(AgentMarketVectorIndexDomainService::class);
        $domainService->expects(self::never())->method('clearAllIndexedMarkets');

        $listener = new AgentMarketVectorIndexReindexSubscriber($appService, $domainService, $this->loggerFactory());
        $listener->process(new AiAbilityUpdatedEvent($oldEntity, $newEntity));
    }

    private function ability(Status $status, string $modelId): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $entity->setOrganizationCode('OFFICIAL');
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
