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
class TraitTest extends TestCase
{
    public function testAllowTraits()
    {
        $options = new SandboxOptions();
        $options->setAllowTraits(true);
        $execution = '<?php
            trait AllowTraits
            {
            }
            
            return "ok";
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertSame($res, 'ok');
    }

    public function testNotAllowTraits()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::DEFINE_TRAIT_ERROR);
        $options = new SandboxOptions();
        $options->setAllowTraits(false);
        $execution = '<?php
            trait NotAllowTraits
            {
            }
            
            return "ok";
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }
}
