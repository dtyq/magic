<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\OpenDev\Provider\User;

use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetListByDeptIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByUserIdParameter;
use Dtyq\EasyDingTalk\Test\OpenDev\OpenDevEndpointBaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class UserEndpointTestEndpoint extends OpenDevEndpointBaseTestCase
{
    public function testGetListByDeptId()
    {
        $openDev = $this->createOpenDevFactory('first');
        $param = new GetListByDeptIdParameter($openDev->accessTokenEndpoint->get());
        $param->setDeptId(837865406);
        $list = $openDev->userEndpoint->getListByDeptId($param);
        $this->assertIsArray($list->getUserList());
    }
}
