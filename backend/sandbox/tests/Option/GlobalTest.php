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
class GlobalTest extends TestCase
{
    public function testNotAllowGlobals()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::GLOBALS_ERROR);
        $options = new SandboxOptions();
        $options->setAllowGlobals(false);
        $execution = '<?php
            global $a;
        ';
        $sandbox = new PHPSandbox($options);
        $sandbox->execute($execution);
    }
}
