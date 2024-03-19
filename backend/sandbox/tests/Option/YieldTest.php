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
class YieldTest extends TestCase
{
    public function testAllowGenerators()
    {
        $options = new SandboxOptions();
        $options->setAllowGenerators(true);
        $execution = '<?php
            $arr = [1,2,3,4];
            foreach ($arr as $v) {
                yield $v;
            }
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $arr = [];
        foreach ($res as $v) {
            $arr[] = $v;
        }
        $this->assertSame(json_encode($arr), json_encode([1, 2, 3, 4]));
    }

    public function testNotAllowGenerators()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::GENERATOR_ERROR);
        $options = new SandboxOptions();
        $options->setAllowGenerators(false);
        $execution = '<?php
            $arr = [1,2,3,4];
            foreach ($arr as $v) {
                yield $v;
            }
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }
}
