<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;

error_reporting(E_ALL);

/**
 * @internal
 * @coversNothing
 */
class SandboxExecuteTest extends TestCase
{
    protected PHPSandbox $sandbox;

    /**
     * Sets up the test.
     */
    public function setUp(): void
    {
        $options = new SandboxOptions();
        $options->setAllowAliases(true);
        $options->setName('sykbxc');
        $options->definitions()->defineFunc('var_dump', function ($a) {
            var_dump($a);
        });
        $this->sandbox = new PHPSandbox($options);
    }

    public function testExecute()
    {
        $options = new SandboxOptions();
        $options->definitions()->defineFunc('myTest', function ($a, $b) {
            return $a + $b;
        });

        $sandbox = new PHPSandbox($options);
        $sandbox->prepare('<?php return myTest(1, $a);');
        $options->definitions()->defineVar('a', 1);
        $res = $sandbox->execute();
        $this->assertSame(2, $res);
    }

    public function testPrepare()
    {
        $code = '<?php
                    use HyperfTest\Script\TestClass;
                    (new TestClass())->echo(23);
                    return (new TestClass())->isRun();';
        $this->sandbox->prepare($code);
        $this->assertIsArray($this->sandbox->getPreparedCode());
    }

    //    public function testExecutePrepareCode()
    //    {
    //        $code = '<?php
    //                    use HyperfTest\Script\TestClass;
    //                    (new TestClass())->echo(23);
    //                    return (new TestClass())->isRun();';
    //        $this->sandbox->prepare($code);
    //        $options1 = new SandboxOptions();
    //        $box1 = new PHPSandbox($options1);
    //        $box1->setPreparedCode($this->sandbox->getPreparedCode());
    //        $this->assertEquals(true, $box1->execute());
    //    }

    //    public function testCoverSandboxVariables()
    //    {
    //        $preparedCode = [
    //            'namespace' => [],
    //            'aliases' => [
    //                'hyperftest\\script\\testclass' => [
    //                    'original' => 'HyperfTest\\Script\\TestClass',
    //                    'alias' => [
    //                        'nodeType' => 'Identifier',
    //                        'name' => 'TestClass',
    //                        'attributes' => [],
    //                    ],
    //                ],
    //            ],
    //            'code' => 'return $_sandbox_->options->getName();',
    //        ];
    //
    //        $options1 = new SandboxOptions();
    //        $options1->setName('1');
    //        $box1 = new PHPSandbox($options1);
    //
    //        $options2 = new SandboxOptions();
    //        $options2->setName('2');
    //        $box2 = new PHPSandbox($options2);
    //
    //        $box1->setPreparedCode($preparedCode);
    //        $box2->setPreparedCode($preparedCode);
    //
    //        $this->assertEquals('1', $box1->execute());
    //        $this->assertEquals('2', $box2->execute());
    //        $this->assertEquals('1', $box1->execute());
    //    }

    //    public function testCoroutineSandbox()
    //    {
    //        $preparedCode = [
    //            'namespace' => [],
    //            'aliases' => [
    //                'hyperftest\\script\\testclass' => [
    //                    'original' => 'HyperfTest\\Script\\TestClass',
    //                    'alias' => [
    //                        'nodeType' => 'Identifier',
    //                        'name' => 'TestClass',
    //                        'attributes' => [],
    //                    ],
    //                ],
    //            ],
    //            'code' => 'return "hello";',
    //        ];
    //
    //        $parallel = new parallel(2);
    //
    //        $parallel->add(function () use ($preparedCode) {
    //            $options1 = new SandboxOptions();
    //            $options1->accessControlOptions->whitelistAlias('HyperfTest\Script\TestClass');
    //            $options1->setAllowAliases(true);
    //            $options1->setName('hello');
    //            $box1 = new PHPSandbox($options1);
    //            $box1->setPreparedCode($preparedCode);
    //            return $box1->execute();
    //        });
    //
    //        $parallel->add(function () use ($preparedCode) {
    //            $options2 = new SandboxOptions();
    //            $options2->accessControlOptions->whitelistAlias('HyperfTest\Script\TestClass');
    //            $options2->setAllowAliases(true);
    //            $options2->setName('world');
    //            $box2 = new PHPSandbox($options2);
    //            $box2->setPreparedCode($preparedCode);
    //            return $box2->execute();
    //        });
    //
    //        $this->assertEquals(['hello', 'hello'], $parallel->wait());
    //    }

    //    public function testExecuteOptions()
    //    {
    //        $preparedCode = [
    //            'namespace' => [],
    //            'aliases' => [
    //                'hyperftest\\script\\testclass' => [
    //                    'original' => 'HyperfTest\\Script\\TestClass',
    //                    'alias' => [
    //                        'nodeType' => 'Identifier',
    //                        'name' => 'TestClass',
    //                        'attributes' => [],
    //                    ],
    //                ],
    //            ],
    //            'code' => 'return $_sandbox_->options->getName();',
    //        ];
    //        $options = new SandboxOptions();
    //        $options->setName('1');
    //        $options2 = new SandboxOptions();
    //        $options2->setName('2');
    //        $box = new PHPSandbox($options);
    //        $box->setPreparedCode($preparedCode);
    //        $this->assertEquals('1', $box->execute());
    //        $this->assertEquals('2', $box->execute(null, false, null, $options2));
    //    }
}
