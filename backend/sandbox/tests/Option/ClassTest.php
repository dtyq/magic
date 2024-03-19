<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Option;

use DateTime;
use PHPSandbox\Error;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ClassTest extends TestCase
{
    public function testNotAllowClasses()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::DEFINE_CLASS_ERROR);
        $options = new SandboxOptions();
        $options->setAllowClasses(false);
        $execution = '<?php
            class AllowClasses
            {
            }
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }

    public function testWhitelistedClasses()
    {
        $options = new SandboxOptions();
        $options->setAllowClasses(true);
        $execution = '<?php
            class WhitelistedClasses
            {
            public function echo()
            {
            
            }
            }
            return new WhitelistedClasses();
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $res = $sandbox->execute();
        $this->assertSame('WhitelistedClasses', get_class($res));
    }

    public function testWhitelistedType()
    {
        $options = new SandboxOptions();
        $options->accessControl()->whitelistType('DateTime');
        $execution = '<?php
            return new DateTime();
        ';
        $sandbox = new PHPSandbox($options);

        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $res = $sandbox->execute();
        $this->assertInstanceOf(DateTime::class, $res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::VALID_TYPE_ERROR);
        $options = new SandboxOptions();
        $sandbox->clear();
        $sandbox->setOptions($options);
        $sandbox->execute($execution);
    }

    public function testBlacklistedType()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BLACKLIST_TYPE_ERROR);
        $options = new SandboxOptions();
        $options->accessControl()->blacklistType('DateTime');
        $execution = '<?php
            return new DateTime();
        ';
        $sandbox = new PHPSandbox($options);

        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $sandbox->execute();
    }

    public function testClassConstFetch()
    {
        $options = new SandboxOptions();
        $options->setAllowClasses(true);
        $execution = '<?php
            class testClassConstFetch
            {
                const a = 1;
                
                public function test($a, $b)
                {
                
                }
            }
            return testClassConstFetch::a;
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $res = $sandbox->execute();
        $this->assertSame(1, $res);
    }
}
