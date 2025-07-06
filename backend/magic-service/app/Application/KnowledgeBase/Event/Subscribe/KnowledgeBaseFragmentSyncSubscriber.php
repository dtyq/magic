<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Application\KnowledgeBase\Service\KnowledgeBaseVectorAppService;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseFragmentSavedEvent;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Codec\Json;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

use function di;

#[AsyncListener]
#[Listener]
readonly class KnowledgeBaseFragmentSyncSubscriber implements ListenerInterface
{
    public function __construct()
    {
    }

    public function listen(): array
    {
        return [
            KnowledgeBaseFragmentSavedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof KnowledgeBaseFragmentSavedEvent) {
            return;
        }
        $knowledge = $event->magicFlowKnowledgeEntity;
        $fragment = $event->magicFlowKnowledgeFragmentEntity;
        /** @var KnowledgeBaseDomainService $magicFlowKnowledgeDomainService */
        $magicFlowKnowledgeDomainService = di(KnowledgeBaseDomainService::class);
        /** @var KnowledgeBaseVectorAppService $knowledgeBaseVectorService */
        $knowledgeBaseVectorService = di(KnowledgeBaseVectorAppService::class);

        // todo 做成队列限流

        try {
            $knowledgeBaseVectorService->checkCollectionExists($knowledge);

            // 如果具有向量的，则不重新嵌入
            if (empty($fragment->getVector())) {
                $fragment->setSyncStatus(KnowledgeSyncStatus::Syncing);
                $magicFlowKnowledgeDomainService->changeSyncStatus($fragment);

                $model = di(ModelGatewayMapper::class)->getEmbeddingModelProxy($knowledge->getModel(), $knowledge->getOrganizationCode());
                $embeddingGenerator = di(EmbeddingGeneratorInterface::class);
                $embeddings = $embeddingGenerator->embedText($model, $fragment->getContent(), options: [
                    'business_params' => [
                        'organization_id' => $knowledge->getOrganizationCode(),
                        'user_id' => $fragment->getModifier(),
                        'business_id' => $knowledge->getCode(),
                        'source_id' => 'fragment_saved',
                    ],
                ]);
                $fragment->setVector(Json::encode($embeddings));
            } else {
                $embeddings = Json::decode($fragment->getVector());
            }

            $knowledge->getVectorDBDriver()->storePoint($knowledge->getCollectionName(), $fragment->getPointId(), $embeddings, $fragment->getPayload());

            $fragment->setSyncStatus(KnowledgeSyncStatus::Synced);
            $magicFlowKnowledgeDomainService->changeSyncStatus($fragment);
        } catch (Throwable $throwable) {
            $fragment->setSyncStatus(KnowledgeSyncStatus::SyncFailed);
            $fragment->setSyncStatusMessage($throwable->getMessage());
            $magicFlowKnowledgeDomainService->changeSyncStatus($fragment);
        }
    }
}
