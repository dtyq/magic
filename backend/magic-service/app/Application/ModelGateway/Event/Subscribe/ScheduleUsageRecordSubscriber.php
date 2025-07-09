<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use DateTime;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[AsyncListener]
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
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ModelUsageEvent) {
            return;
        }
        $dataIsolation = LLMDataIsolation::create($event->getOrganizationCode());

        $this->recordMessageLog($dataIsolation, $event);
    }

    /**
     * Record message log.
     */
    private function recordMessageLog(LLMDataIsolation $dataIsolation, ModelUsageEvent $modelUsageEvent): void
    {
        $msgLog = new MsgLogEntity();
        $msgLog->setUseAmount(0);
        $msgLog->setUseToken($modelUsageEvent->getUsage()->getTotalTokens());
        $msgLog->setModel($modelUsageEvent->getModelId());
        $msgLog->setUserId($modelUsageEvent->getUserId());
        $msgLog->setAppCode($modelUsageEvent->getAppId());
        $msgLog->setOrganizationCode($modelUsageEvent->getOrganizationCode());
        $msgLog->setBusinessId($modelUsageEvent->getBusinessParam('business_id') ?? '');
        $msgLog->setSourceId($modelUsageEvent->getBusinessParam('source_id') ?? '');
        $msgLog->setUserName($modelUsageEvent->getBusinessParam('user_name') ?? '');
        $msgLog->setAccessTokenId($modelUsageEvent->getBusinessParam('access_token_id') ?? '');
        $msgLog->setProviderId($modelUsageEvent->getBusinessParam('service_provider_id') ?? '');
        $msgLog->setProviderModelId($modelUsageEvent->getBusinessParam('service_provider_model_id') ?? '');
        $msgLog->setCreatedAt(new DateTime());
        $this->msgLogDomainService->create($dataIsolation, $msgLog);
    }
}
