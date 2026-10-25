<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use DateTime;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Api\Response\Usage;
use Psr\Container\ContainerInterface;

#[AsyncListener(driver: 'coroutine')]
#[Listener]
class ScheduleUsageRecordSubscriber implements ListenerInterface
{
    private MsgLogDomainService $msgLogDomainService;

    public function __construct(protected ContainerInterface $container)
    {
        $this->msgLogDomainService = $this->container->get(MsgLogDomainService::class);
    }

    public function listen(): array
    {
        return [
            ModelUsageEvent::class,
            ImageGeneratedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof ModelUsageEvent) {
            if ($event->getBusinessParam('is_success', true) === false) {
                return;
            }

            $dataIsolation = LLMDataIsolation::create($event->getOrganizationCode());
            $this->recordMessageLog(
                $dataIsolation,
                usage: $event->getUsage(),
                model: $event->getModelId(),
                modelVersion: $event->getModelVersion(),
                organizationCode: $event->getOrganizationCode(),
                userId: $event->getUserId(),
                appCode: $event->getAppId(),
                businessParams: $event->getBusinessParams(),
            );
            return;
        }

        if ($event instanceof ImageGeneratedEvent) {
            $businessParams = $event->getBusinessParams();
            if (strtoupper((string) ($businessParams['status'] ?? '')) !== 'SUCCESS') {
                return;
            }

            $usage = $event->getUsage() ?? new Usage(promptTokens: 0, completionTokens: 0, totalTokens: 0);
            $modelVersion = (string) ($businessParams['model_version'] ?? $event->getModel());
            $model = (string) ($businessParams['model_id'] ?? $event->getModel());
            $providerModelId = (string) ($businessParams['provider_model_id'] ?? $event->getProviderModelId());
            $businessParams['provider_model_id'] = $providerModelId;
            if (! isset($businessParams['access_token_id'])) {
                $businessParams['access_token_id'] = $event->getAccessTokenId() ?? '';
            }

            $dataIsolation = LLMDataIsolation::create($event->getOrganizationCode());
            $this->recordMessageLog(
                $dataIsolation,
                usage: $usage,
                model: $model,
                modelVersion: $modelVersion,
                organizationCode: $event->getOrganizationCode(),
                userId: $event->getUserId(),
                appCode: (string) ($businessParams['app_id'] ?? ''),
                businessParams: $businessParams,
            );
        }
    }

    /**
     * 统一记录模型调用日志。
     */
    private function recordMessageLog(
        LLMDataIsolation $dataIsolation,
        Usage $usage,
        string $model,
        string $modelVersion,
        string $organizationCode,
        string $userId,
        string $appCode,
        array $businessParams
    ): void {
        $msgLog = new MsgLogEntity();
        $msgLog->setUseAmount(0);
        $msgLog->setUseToken($usage->getTotalTokens());

        // Set basic token information
        $msgLog->setPromptTokens($usage->getPromptTokens());
        $msgLog->setCompletionTokens($usage->getCompletionTokens());

        // Set cache-related token information
        $msgLog->setCacheWriteTokens($usage->getCacheWriteInputTokens());

        // Priority: getCacheReadInputTokens, fallback to getCachedTokens if zero
        $cacheReadTokens = $usage->getCacheReadInputTokens();
        if ($cacheReadTokens === 0) {
            $cacheReadTokens = $usage->getCachedTokens();
        }
        $msgLog->setCacheReadTokens($cacheReadTokens);

        $msgLog->setModel($model);
        $msgLog->setModelVersion($modelVersion);
        $msgLog->setUserId($userId);
        $msgLog->setAppCode($appCode);
        $msgLog->setOrganizationCode($organizationCode);
        $msgLog->setBusinessId((string) ($businessParams['business_id'] ?? ''));
        $msgLog->setSourceId((string) ($businessParams['source_id'] ?? ''));
        $msgLog->setUserName((string) ($businessParams['user_name'] ?? ''));
        $msgLog->setAccessTokenId($businessParams['access_token_id'] ?? '');
        $msgLog->setProviderId($businessParams['service_provider_id'] ?? '');
        $msgLog->setProviderModelId($businessParams['service_provider_model_id'] ?? $businessParams['provider_model_id'] ?? '');
        $msgLog->setCreatedAt(new DateTime());
        $this->msgLogDomainService->create($dataIsolation, $msgLog);
    }
}
