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
class IncludeTest extends TestCase
{
    public function testNotAllowIncludes()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::INCLUDE_ERROR);
        $options = new SandboxOptions();
        $options->setAllowIncludes(false);
        $execution = function () {
            include 'xxxx';
        };
        $sandbox = new PHPSandbox($options);
        $sandbox->execute($execution);
    }

    public function testDefinedIncludes()
    {
        $options = new SandboxOptions();
        $options->definitions()->defineFunc('include', function ($file) {
            return true;
        });
        $options->setAllowIncludes(true);
        $execution = function () {
            return include 'xxxx';
        };
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertTrue($res);
    }

    public function testSandboxIncludes()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::INCLUDE_ERROR);
        $options = new SandboxOptions();
        $options->setAllowIncludes(true);
        $options->setSandboxIncludes(true);
        $execution = function () {
            return include 'test/Script/Code/test.php';
        };
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        var_dump($res);
    }
}
