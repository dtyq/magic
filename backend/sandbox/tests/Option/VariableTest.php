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
class VariableTest extends TestCase
{
    public function testAllowVariables()
    {
        $options = new SandboxOptions();
        $options->setAllowVariables(true);
        $execution = '<?php
            $a = 1;
            return $a;
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame($res, 1);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::VALID_VAR_ERROR);
        $sandbox->clear();
        $options->setAllowVariables(false);
        $res = $sandbox->execute($execution);
    }

    public function testAllowStaticVariables()
    {
        $options = new SandboxOptions();
        $options->setAllowFunctions(true);
        $options->setAllowStaticVariables(true);
        $execution = '<?php
            function AllowStaticVariables(){
                static $a = 1;
                
                ++$a;
                return $a;
            }
            AllowStaticVariables();
            return AllowStaticVariables();
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame($res, 3);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::STATIC_VAR_ERROR);
        $sandbox->clear();
        $options->setAllowStaticVariables(false);
        $sandbox->execute($execution);
    }

    public function testDefinedConst()
    {
        $options = new SandboxOptions();
        $options->accessControl()->whitelistFunc('define');
        $options->definitions()->defineConst('DefinedConst', 1);
        $execution = '<?php
            return DefinedConst;
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame($res, 1);
    }

    public function testWhitelistedConsts()
    {
        $options = new SandboxOptions();
        define('testWhitelistedConsts', 1);
        $options->accessControl()->whitelistConst('testWhitelistedConsts');
        $execution = '<?php
            return testWhitelistedConsts;
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame($res, 1);
    }

    public function testBlacklistedConsts()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BLACKLIST_CONST_ERROR);
        $options = new SandboxOptions();
        define('testBlacklistedConsts', 1);
        $options->accessControl()->blacklistConst('testBlacklistedConsts');
        $options->definitions()->defineConst('DefinedConst', 1);
        $execution = '<?php
            return testBlacklistedConsts;
        ';
        $sandbox = new PHPSandbox($options);
        $sandbox->execute($execution);
    }

    public function testAllowReferences()
    {
        $options = new SandboxOptions();
        $options->setAllowReferences(true);
        $execution = '<?php
            $a = 1;
            $b = &$a;
            return $b;
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame(1, $res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BYREF_ERROR);
        $sandbox->clear();
        $options->setAllowReferences(false);
        $sandbox->execute($execution);
    }

    public function testWhitelistedMagicConsts()
    {
        $options = new SandboxOptions();
        $options->accessControl()->whitelistMagicConst('__LINE__');
        $execution = '<?php
            return __LINE__;
        ';
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame(3, $res);
    }

    public function testBlacklistedMagicConsts()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BLACKLIST_MAGIC_CONST_ERROR);
        $options = new SandboxOptions();
        $options->accessControl()->blacklistMagicConst('__LINE__');
        $execution = '<?php
            return __LINE__;
        ';
        $sandbox = new PHPSandbox($options);
        $sandbox->execute($execution);
    }

    public function testDefinedMagicConst()
    {
        $options = new SandboxOptions();
        $options->definitions()->defineMagicConst('__LINE__', 999);
        $execution = '<?php
            return __LINE__;
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $res = $sandbox->execute();
        $this->assertSame(999, $res);
    }

    public function testSuperglobals()
    {
        $options = new SandboxOptions();
        $execution = '<?php
            return $_GET;
        ';
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        $this->assertIsArray($res);
    }
}
