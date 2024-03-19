<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\PhpScript\Repository;

use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableClass;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableCodeInterface;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableConstant;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableFunction;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableType;
use Dtyq\RuleEngineCore\PhpScript\Repository\DefaultExecutableCodeRepository;
use HyperfTest\Cases\AbstractTestCase;
use HyperfTest\Mock\ExecutableCode\TestClass;

/**
 * @internal
 * @coversNothing
 */
class DefaultExecutableCodeRepositoryTest extends AbstractTestCase
{
    public static function setUpBeforeClass(): void
    {
        DefaultExecutableCodeRepository::$executableCodes = [];
    }

    /**
     * @dataProvider registerExecutableCodeProvider
     */
    public function testRegisterExecutableCode(ExecutableCodeInterface $executableCode)
    {
        $repository = new DefaultExecutableCodeRepository();
        $repository->registerExecutableCode($executableCode);

        $this->addToAssertionCount(1);
    }

    public function registerExecutableCodeProvider(): array
    {
        return [
            [
                new ExecutableFunction('name', function () { return 111; }, 'test-group'),
            ],
            [
                ExecutableFunction::fromPhp('array_map', null, 'test-group'),
            ],
            [
                new ExecutableClass(TestClass::class),
            ],
            [
                new ExecutableConstant('PHP_EOL', null, 'test-group2'),
            ],
        ];
    }

    /**
     * @dataProvider getExecutableCodesByTypeProvider
     * @depends  testRegisterExecutableCode
     */
    public function testGetExecutableCodesByType(ExecutableType $executableType, ?string $ruleGroup)
    {
        $repository = new DefaultExecutableCodeRepository();
        $this->assertCount(1, $repository->getExecutableCodesByType($executableType, $ruleGroup));
    }

    public function getExecutableCodesByTypeProvider(): array
    {
        return [
            [
                ExecutableType::from(ExecutableType::FUNCTION_TYPE),
                'test-group',
            ],
            [
                ExecutableType::from(ExecutableType::CONSTANT_TYPE),
                'test-group2',
            ],
            [
                ExecutableType::from(ExecutableType::CLASS_TYPE),
                null,
            ],
        ];
    }

    /**
     * @depends testGetExecutableCodesByType
     */
    public function testUnregisterExecutableCode()
    {
        $repository = new DefaultExecutableCodeRepository();
        foreach ($this->registerExecutableCodeProvider() as $value) {
            /** @var ExecutableCodeInterface $executableCode */
            $executableCode = array_pop($value);
            $repository->unregisterExecutableCode($executableCode->getType(), $executableCode->getName(), $executableCode->getRuleGroup());
        }

        foreach (DefaultExecutableCodeRepository::$executableCodes as $value) {
            foreach ($value as $v) {
                $this->assertEmpty($v);
            }
        }
    }
}
