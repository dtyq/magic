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
class HtmlTest extends TestCase
{
    public function testAllowEscaping()
    {
        $options = new SandboxOptions();
        $options->setAllowEscaping(true);
        $sandbox = new PHPSandbox($options);
        $execution = '?><h1>Hello World</h1><?php';
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
        $this->assertSame($this->getActualOutput(), '<h1>Hello World</h1>');

        $sandbox->clear();
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::ESCAPE_ERROR);
        $options->setAllowEscaping(false);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }
}
