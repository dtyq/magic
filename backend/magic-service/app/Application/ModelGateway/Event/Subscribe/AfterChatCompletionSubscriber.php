<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ChatUsageEvent;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Event\AfterChatCompletionsEvent;
use Hyperf\Odin\Event\AfterChatCompletionsStreamEvent;

#[AsyncListener]
#[Listener]
class AfterChatCompletionSubscriber implements ListenerInterface
{
    public function listen(): array
    {
        return [
            AfterChatCompletionsStreamEvent::class,
            AfterChatCompletionsEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof AfterChatCompletionsEvent) {
            return;
        }

        $completionRequest = $event->getCompletionRequest();
        $completionResponse = $event->getCompletionResponse();

        $usage = $completionResponse->getUsage();
        if (! $usage) {
            $completionRequest->calculateTokenEstimates();
            $completionResponse->calculateTokenEstimates();
            $usage = new Usage(
                promptTokens: $completionRequest->getTotalTokenEstimate() ?? 0,
                completionTokens: $completionResponse->calculateTokenEstimates() ?? 0,
                totalTokens: ($completionRequest->getTotalTokenEstimate() ?? 0) + ($completionResponse->calculateTokenEstimates() ?? 0),
            );
        }

        $modelId = $completionRequest->getModel();
        $businessParams = $completionRequest->getBusinessParams();

        $chatUsageEvent = new ChatUsageEvent(
            modelId: $modelId,
            usage: $usage,
            organizationCode: $businessParams['organization_id'] ?? '',
            userId: $businessParams['user_id'] ?? '',
            appId: $businessParams['app_id'] ?? '',
            serviceProviderModelId: $businessParams['service_provider_model_id'] ?? '',
        );

        AsyncEventUtil::dispatch($chatUsageEvent);
    }
}
