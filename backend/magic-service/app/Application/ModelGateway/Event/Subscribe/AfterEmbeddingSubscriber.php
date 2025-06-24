<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ModelUsageEvent;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Constants\ModelType;
use Hyperf\Odin\Event\AfterEmbeddingsEvent;

#[AsyncListener]
#[Listener]
class AfterEmbeddingSubscriber implements ListenerInterface
{
    public function process(object $event): void
    {
        if (! $event instanceof AfterEmbeddingsEvent) {
            return;
        }

        $embeddingRequest = $event->getEmbeddingRequest();
        $embeddingResponse = $event->getEmbeddingResponse();

        $usage = $embeddingResponse->getUsage();
        if (! $usage) {
            $embeddingRequest->calculateTokenEstimates();
            $usage = new Usage(
                promptTokens: $embeddingRequest->getTotalTokenEstimate() ?? 0,
                completionTokens: 0,
                totalTokens: $embeddingRequest->getTotalTokenEstimate() ?? 0,
            );
        }

        $modelVersion = $embeddingRequest->getModel();
        $businessParams = $embeddingRequest->getBusinessParams();
        $modelId = empty($businessParams['model_id']) ? $modelVersion : $businessParams['model_id'];

        $chatUsageEvent = new ModelUsageEvent(
            modelType: ModelType::EMBEDDING,
            modelId: $modelId,
            modelVersion: $modelVersion,
            usage: $usage,
            organizationCode: $businessParams['organization_id'] ?? '',
            userId: $businessParams['user_id'] ?? '',
            appId: $businessParams['app_id'] ?? '',
            serviceProviderModelId: $businessParams['service_provider_model_id'] ?? '',
            businessParams: $businessParams,
        );

        AsyncEventUtil::dispatch($chatUsageEvent);
    }

    public function listen(): array
    {
        return [
            AfterEmbeddingsEvent::class,
        ];
    }
}
