<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Option;

use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ArgTest extends TestCase
{
    public function testSandboxStrings()
    {
        $options = new SandboxOptions();
        $options->setSandboxStrings(true);
        $execution = function () {
            $array = [];
            return is_array($array);
        };
        $options->accessControl()->whitelistFunc('is_array');
        $sandbox = new PHPSandbox($options);

        $preCode = $sandbox->prepare($execution);
        $this->assertTrue($sandbox->execute());
    }
}
