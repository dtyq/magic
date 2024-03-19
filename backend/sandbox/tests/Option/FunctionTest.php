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
class FunctionTest extends TestCase
{
    public function testWhitelistFunc()
    {
        $options = new SandboxOptions();
        $execution = function () {
            $array = [];
            return is_array($array);
        };
        $options->accessControl()->whitelistFunc('is_array');
        $sandbox = new PHPSandbox($options);
        $this->assertTrue($sandbox->execute($execution));

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::VALID_FUNC_ERROR);
        $options = new SandboxOptions();
        $sandbox->setOptions($options);
        $sandbox->execute($execution);
    }

    public function testBlacklistFunc()
    {
        $options = new SandboxOptions();
        $execution = function () {
            $array = [];
            return is_array($array);
        };

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BLACKLIST_FUNC_ERROR);
        $options->accessControl()->blacklistFunc('is_array');
        $sandbox = new PHPSandbox($options);
        $sandbox->setOptions($options);
        $sandbox->execute($execution);
    }

    public function testAllowClosures()
    {
        $options = new SandboxOptions();
        $execution = function () {
            $a = function () {
                return true;
            };
            return $a();
        };
        $options->setAllowClosures(true);
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $this->assertTrue($sandbox->execute());

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::CLOSURE_ERROR);
        $options->setAllowClosures(false);
        $sandbox->execute($execution);
    }

    public function testDefineFunc()
    {
        $options = new SandboxOptions();
        $options->definitions()->defineFunc('myFun', function () {
            return true;
        });
        $sandbox = new PHPSandbox($options);
        $execution = '<?php
            return myFun();
        ';
        $this->assertTrue($sandbox->execute($execution));

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::VALID_FUNC_ERROR);
        $sandbox->setOptions(new SandboxOptions());
        $sandbox->execute($execution);
    }

    // TODO:get_declared_interfaces, get_declared_traits
    public function testOverwriteDefinedFuncs()
    {
        $func = ['get_defined_vars', 'get_defined_functions', 'get_defined_constants', 'define', 'get_declared_classes', 'get_declared_interfaces'];
        $options = new SandboxOptions();
        $options->setOverwriteDefinedFuncs(true);
        $options->accessControl()
            ->whitelistFunc($func);

        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute(function () {
            $a = 1;
            return get_defined_vars();
        });
        $this->assertCount(1, $res);
        $this->assertArrayHasKey('a', $res);

        $sandbox->clear();
        $res = $sandbox->execute(function () {
            return get_defined_functions();
        });
        $this->assertCount(count($func), $res);

        $sandbox->clear();
        $options->accessControl()->whitelistConst('TEST');
        $res = $sandbox->execute(function () {
            define('TEST', 1);
            return get_defined_constants();
        });
        $this->assertCount(1, $res);
        $this->assertTrue(in_array('TEST', $res));

        $sandbox->clear();
        $options->accessControl()->whitelistClass('DateTime');
        $res = $sandbox->execute(function () {
            return get_declared_classes();
        });
        $this->assertCount(1, $res);
    }

    /**
     * @dataProvider overwriteSandboxedStringFuncsProvider
     */
    public function testOverwriteSandboxedStringFuncs(string $funName, string $output, callable $execution, ?callable $assert)
    {
        if ($output) {
            $this->expectOutputString($output);
        }
        $options = new SandboxOptions();
        $options->setOverwriteSandboxedStringFuncs(true);
        $options->accessControl()->whitelistFunc($funName);
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        if ($res !== null) {
            $assert($res);
        }
    }

    public function overwriteSandboxedStringFuncsProvider(): array
    {
        return [
            [
                'var_dump',
                "int(1)\n",
                function () { var_dump(1); },
                null,
            ],
            [
                'print_r',
                '1',
                function () { print_r(1); },
                null,
            ],
            [
                'var_export',
                '1',
                function () { var_export(1); },
                null,
            ],
            [
                'intval',
                '',
                function () { return intval('1'); },
                function ($res) { $this->assertSame($res, 1); },
            ],
            [
                'floatval',
                '',
                function () { return floatval('1.1'); },
                function ($res) { $this->assertSame($res, 1.1); },
            ],
            [
                'boolval',
                '',
                function () { return boolval('1.1'); },
                function ($res) { $this->assertSame($res, true); },
            ],
            [
                'is_string',
                '',
                function () { return is_string('1.1'); },
                function ($res) { $this->assertSame($res, true); },
            ],
            [
                'is_object',
                '',
                function () { return is_object('1.1'); },
                function ($res) {$this->assertSame($res, false); },
            ],
            [
                'is_scalar',
                '',
                function () { return is_scalar('1.1'); },
                function ($res) { $this->assertSame($res, true); },
            ],
            [
                'is_callable',
                '',
                function () { return is_callable('1.1'); },
                function ($res) { $this->assertSame($res, false); },
            ],
            [
                'array_key_exists',
                '',
                function () { return array_key_exists('a', ['a' => 1]); },
                function ($res) { $this->assertSame($res, true); },
            ],
        ];
    }

    /**
     * @dataProvider overwriteFuncGetArgsProvide
     */
    public function testOverwriteFuncGetArgs(string $funName, callable $execution, ?callable $assert)
    {
        $options = new SandboxOptions();
        $options->setOverwriteFuncGetArgs(true);
        $options->setAllowFunctions(true);
        $options->accessControl()->whitelistFunc($funName);
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $res = $sandbox->execute();
        if ($res !== null) {
            $assert($res);
        }
    }

    public function overwriteFuncGetArgsProvide()
    {
        return [
            [
                'func_get_args',
                function () {
                    function aaa1($a, $b)
                    {
                        return func_get_args();
                    }
                    return aaa1(1, 2);
                },
                function ($res) {
                    $this->assertCount(2, $res);
                },
            ],
            [
                'func_get_arg',
                function () {
                    function aaa2($a, $b)
                    {
                        return func_get_arg(1);
                    }
                    return aaa2(1, 2);
                },
                function ($res) {
                    $this->assertSame(2, $res);
                },
            ],
            [
                'func_num_args',
                function () {
                    function aaa3($a, $b)
                    {
                        return func_num_args();
                    }
                    return aaa3(1, 2);
                },
                function ($res) {
                    $this->assertSame(2, $res);
                },
            ],
        ];
    }

    public function testAllowErrorSuppressing()
    {
        $func = ['unlink'];
        $execution = function () {
            return @unlink('xxx');
        };
        $options = new SandboxOptions();
        $options->accessControl()->whitelistFunc($func);
        $options->setAllowErrorSuppressing(true);
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertFalse($res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::ERROR_SUPPRESS_ERROR);
        $sandbox->clear();
        $options->setAllowErrorSuppressing(false);
        $sandbox->execute($execution);
    }

    public function testAllowBackticks()
    {
        $options = new SandboxOptions();
        $options->setAllowBackticks(true);
        $execution = function () {
            return shell_exec('echo 1111');
        };
        $sandbox = new PHPSandbox($options);
        $res = $sandbox->execute($execution);
        $this->assertSame("1111\n", $res);

        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::BACKTICKS_ERROR);
        $sandbox->clear();
        $options->setAllowBackticks(false);
        $sandbox->execute($execution);
    }
}
