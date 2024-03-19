<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Option;

use PHPSandbox\Error;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class InterfaceTest extends TestCase
{
    public function testAllowInterfaces()
    {
        $options = new SandboxOptions();
        $options->setAllowInterfaces(true);
        $execution = '<?php
            interface AllowInterfaces
            {
            }
            
            return "ok";
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertSame($res, 'ok');
    }

    public function testNotAllowInterfaces()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::DEFINE_INTERFACE_ERROR);
        $options = new SandboxOptions();
        $options->setAllowInterfaces(false);
        $execution = '<?php
            interface NotAllowInterfaces
            {
            }
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }
}
