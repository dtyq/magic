<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Event\Subscribe;

use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\Domain\Permission\Event\FunctionPermissionChanged;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

#[Listener]
class ClawFunctionPermissionChangedListener implements ListenerInterface
{
    public function __construct(private readonly MagicClawReconciliationAppService $service)
    {
    }

    public function listen(): array
    {
        return [FunctionPermissionChanged::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof FunctionPermissionChanged
            || ($event->functionCodes !== null && ! in_array(MagicClawRuntimePolicyDomainService::ACCESS, $event->functionCodes, true))) {
            return;
        }
        // Only persist work in the policy transaction. The existing coroutine subscriber
        // scans/stops resources later; a lost notification is recovered by the one retry cron.
        $this->service->requestReconciliation($event->organizationCode, 'policy_changed', true, actor: $event->actor);
    }
}
