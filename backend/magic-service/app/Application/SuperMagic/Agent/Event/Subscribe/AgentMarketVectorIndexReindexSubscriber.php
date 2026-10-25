<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Event\Subscribe;

use App\Application\SuperMagic\Agent\Service\AdminSuperMagicAgentAppService;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Event\KnowledgeBaseEmbeddingModelUpdatedEvent;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[AsyncListener(driver: 'queue_amqp')]
#[Listener]
final readonly class AgentMarketVectorIndexReindexSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private AdminSuperMagicAgentAppService $adminSuperMagicAgentAppService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('vector-index-sync');
    }

    public function listen(): array
    {
        return [KnowledgeBaseEmbeddingModelUpdatedEvent::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseEmbeddingModelUpdatedEvent
            || $event->newEntity->getCode() !== AiAbilityCode::KnowledgeBaseEmbeddingModel) {
            return;
        }

        $organizationCode = $event->newEntity->getOrganizationCode();
        try {
            if ($organizationCode !== OfficialOrganizationUtil::getOfficialOrganizationCode()) {
                $this->logger->info('Agent market vector reindex skipped for non-official organization', [
                    'organization_code' => $organizationCode,
                ]);
                return;
            }

            if (! $this->shouldReindex($event->oldEntity, $event->newEntity)) {
                return;
            }

            $result = $this->adminSuperMagicAgentAppService->reindexAllMarketVectors(
                SuperMagicAgentDataIsolation::create($organizationCode, 'system'),
                forceReEmbedding: true,
            );
            $this->logger->info('Agent market full vector sync queued after embedding ability update', $result + [
                'model_id' => $this->modelId($event->newEntity),
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('Agent market vector index refresh failed after embedding ability update', [
                'organization_code' => $organizationCode,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }
    }

    private function shouldReindex(AiAbilityEntity $oldEntity, AiAbilityEntity $newEntity): bool
    {
        if (! $newEntity->isEnabled()) {
            return false;
        }

        return ! $oldEntity->isEnabled() || $this->modelId($oldEntity) !== $this->modelId($newEntity);
    }

    private function modelId(AiAbilityEntity $entity): string
    {
        return trim((string) ($entity->getConfig()['model_id'] ?? ''));
    }
}
