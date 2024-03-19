<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Api\Admin\Agent;

use App\Application\Admin\Agent\Service\AdminAgentAppService;
use App\Interfaces\Admin\DTO\Request\QueryPageAgentDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class AdminAgentTest extends BaseTest
{
    public function testQueryAgents()
    {
        $userId = '2';
        $organizationCode = 'DT001';
        $magicUserAuthorization = new MagicUserAuthorization();
        $magicUserAuthorization->setId($userId);
        $magicUserAuthorization->setOrganizationCode($organizationCode);
        $service = di(AdminAgentAppService::class);
        $queriesAgents = $service->queriesAgents($magicUserAuthorization, new QueryPageAgentDTO());
    }
}
