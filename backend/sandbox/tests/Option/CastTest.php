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
class CastTest extends TestCase
{
    public function testNotAllowCasting()
    {
        $this->expectException(Error::class);
        $this->expectExceptionCode(Error::CAST_ERROR);
        $options = new SandboxOptions();
        $options->setAllowCasting(false);
        $execution = function () {
            return (int) 'aaaaa';
        };
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        $sandbox->execute();
    }

    /**
     * @dataProvider  allowCastingProvider
     */
    public function testAllowCasting(callable $execution, ?callable $assert)
    {
        $options = new SandboxOptions();
        $options->setAllowCasting(true);
        $sandbox = new PHPSandbox($options);
        $preCode = $sandbox->prepare($execution);
        //        var_dump($preCode);
        $res = $sandbox->execute();
        $assert($res);
    }

    public function allowCastingProvider(): array
    {
        return [
            [
                function () { return (int) '111'; },
                function ($res) {
                    $this->assertSame($res, 111);
                },
            ],
            [
                function () { return (float) '111.1'; },
                function ($res) {
                    $this->assertSame($res, 111.1);
                },
            ],
            [
                function () { return (bool) '1'; },
                function ($res) {
                    $this->assertSame($res, true);
                },
            ],
            [
                function () { return (array) '1'; },
                function ($res) {
                    $this->assertSame(json_encode($res), json_encode(['1']));
                },
            ],
            [
                function () { return (object) '1'; },
                function ($res) {
                    $this->assertSame(json_encode($res), '{"scalar":"1"}');
                },
            ],
        ];
    }
}
