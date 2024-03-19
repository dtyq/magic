<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\BizData;

class SyncAction
{
    /**
     * 刷新ticket.
     */
    public const SuiteTicket = 'suite_ticket';

    /**
     * 授权.
     */
    public const OrgSuiteAuth = 'org_suite_auth';

    /**
     * 解除授权.
     */
    public const OrgSuiteRelieve = 'org_suite_relieve';
}
