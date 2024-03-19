<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\ExecuteManager\ExecutionData;

use App\Application\Flow\ExecuteManager\ExecutionData\TriggerDataUserExtInfo;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class TriggerDataUserExtInfoTest extends ExecuteManagerBaseTest
{
    public function testGet()
    {
        $extInfo = new TriggerDataUserExtInfo('DT001', 'usi_a450dd07688be6273b5ef112ad50ba7e');
        $this->assertIsArray($extInfo->getDepartments());
    }
}
