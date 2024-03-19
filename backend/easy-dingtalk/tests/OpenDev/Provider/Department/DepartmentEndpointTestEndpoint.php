<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\OpenDev\Provider\Department;

use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetAllParentDepartmentByUserParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetDeptByIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetSubParameter;
use Dtyq\EasyDingTalk\Test\OpenDev\OpenDevEndpointBaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class DepartmentEndpointTestEndpoint extends OpenDevEndpointBaseTestCase
{
    public function testGetSUb()
    {
        $openDev = $this->createOpenDevFactory('first');
        $param = new GetSubParameter($openDev->accessTokenEndpoint->get());
        $param->setDeptId(837530544);
        $list = $openDev->departmentEndpoint->getSub($param);
        $this->assertIsArray($list);
    }
}
