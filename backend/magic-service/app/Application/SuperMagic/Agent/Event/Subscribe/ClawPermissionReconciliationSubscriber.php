<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Event\Subscribe;

use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\Domain\Contact\Event\DepartmentMembershipChanged;
use App\Domain\SuperMagic\Agent\Event\ClawPermissionReconciliationRequestedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

#[AsyncListener(driver: 'coroutine')]
#[Listener]
class ClawPermissionReconciliationSubscriber implements ListenerInterface
{
    public function __construct(private readonly MagicClawReconciliationAppService $service)
    {
    }

    public function listen(): array
    {
        return [ClawPermissionReconciliationRequestedEvent::class, DepartmentMembershipChanged::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ClawPermissionReconciliationRequestedEvent && ! $event instanceof DepartmentMembershipChanged) {
            return;
        }
        if ($event instanceof DepartmentMembershipChanged) {
            // Already inside the deferred subscriber: no second deferred notification is needed.
            $this->service->requestReconciliation($event->organizationCode, 'membership_changed', true, false);
        }
        // Continue only while real work is due. Occupied slots and future retries return immediately.
        while ($this->service->executeForOrganization($event->organizationCode)) {
            usleep(1000000);
        }
    }
}
