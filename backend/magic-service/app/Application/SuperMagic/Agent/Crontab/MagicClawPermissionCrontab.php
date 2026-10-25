<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Crontab;

use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use Hyperf\Crontab\Annotation\Crontab;

class MagicClawPermissionCrontab
{
    public function __construct(private readonly MagicClawReconciliationAppService $service)
    {
    }

    // Events handle normal changes. This schedule only resumes recorded, due work.
    #[Crontab(rule: '0 */10 * * * *', name: 'MagicClawPermissionReconcile', singleton: true, mutexExpires: 600, onOneServer: true)]
    public function execute(): void
    {
        $this->service->execute();
    }
}
