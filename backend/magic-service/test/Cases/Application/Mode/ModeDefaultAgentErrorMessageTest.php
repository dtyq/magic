<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode;

use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModeDefaultAgentErrorMessageTest extends TestCase
{
    public function testDefaultAgentProtectionMessagesDescribeTheBlockedOperation(): void
    {
        $messages = require BASE_PATH . '/storage/languages/zh_CN/mode.php';

        self::assertSame(
            '当前员工是平台默认员工，无法禁用。请先更换默认员工后再试。',
            $messages['system_default_agent_cannot_disable']
        );
        self::assertSame(
            '当前员工是平台默认员工，无法设置组织白名单。请先更换默认员工后再试。',
            $messages['system_default_agent_cannot_set_whitelist']
        );
        self::assertSame(
            '当前员工是平台默认员工，无法修改员工标识。请先更换默认员工后再试。',
            $messages['system_default_agent_cannot_change_identifier']
        );
    }
}
