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
class NamespaceTest extends TestCase
{
    public function testAllowNamespaces()
    {
        $options = new SandboxOptions();
        $options->setAllowNamespaces(true);
        $execution = '<?php
            namespace testAllowNamespaces;
            return 1;
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertSame(1, $res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::DEFINE_NAMESPACE_ERROR);
        $sandbox->clear();
        $options->setAllowNamespaces(false);
        $sandbox->execute($execution);
    }

    public function testAllowAliases()
    {
        $options = new SandboxOptions();
        $options->setAllowAliases(true);
        $execution = '<?php
            use DateTime;
            return 1;
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertSame(1, $res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::DEFINE_ALIAS_ERROR);
        $sandbox->clear();
        $options->setAllowAliases(false);
        $sandbox->execute($execution);
    }
}
