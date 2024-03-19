<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace test;

use PHPSandbox\Options\AccessControl;
use PHPSandbox\Options\Definitions;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\Options\Validation;
use PHPSandbox\Options\ValidationError;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 * @coversNothing
 */
class OptionsTest extends TestCase
{
    public function setUp(): void
    {
    }

    /**
     * @throws Throwable
     */
    public function testOptions()
    {
        $options = new SandboxOptions();

        $options->setName('hello');
        $this->assertEquals('hello', $options->getName());

        $options->setValidatePrimitives(false);
        $this->assertEquals(false, $options->isValidatePrimitives());

        $options->setOption('autoWhitelistGlobals', false);
        $this->assertEquals(false, $options->getOption('autoWhitelistGlobals'));

        $options->setOption('name', 'world');
        $this->assertEquals('world', $options->getOption('name'));

        $this->assertEquals($options->accessControl(), $options->accessControl());
        $this->assertEquals($options->definitions(), $options->definitions());
        $this->assertEquals($options->getValidationError(), $options->getValidationError());
        $this->assertEquals($options->validation(), $options->validation());
    }

    public function testValidationError()
    {
        $options = new SandboxOptions();
        $error = new ValidationError();
        $error->setValidationErrorHandler(function ($error, $object) {
            echo '1';
        });
        $options->setValidationError($error);
        $this->assertEquals(true, is_callable($options->validationError->getValidationErrorHandler()));
    }

    public function testAccessControlOptions()
    {
        $options = new SandboxOptions();
        $accessControlOptions = new AccessControl();
        $accessControlOptions->whitelistFunc('ABC_DEF');
        $accessControlOptions->blacklistClass('HELLOworld');
        $options->setAccessControl($accessControlOptions);
        $this->assertEquals(true, $options->accessControl()->getWhitelistedFunc('abc_def'));
        $this->assertEquals(true, $options->accessControl()->getBlacklistedClass('helloworld'));
    }

    public function testDefinitions()
    {
        $options = new SandboxOptions();
        $definition = new Definitions();
        $definition->defineFunc('getName', function () {
            echo 'sykbxc';
        });
        $options->setDefinitions($definition);
        $this->assertEquals(true, is_callable($options->definitions()->getDefinedFunc('getname', 'function')));
        $this->assertEquals(1, $options->definitions()->hasDefinedFuncs());
        $this->assertEquals(true, $options->definitions()->isDefinedFunc('getName'));
        $this->assertEquals(true, $options->definitions()->isDefinedFunc('getName'));
        $this->assertEquals(false, is_callable($options->definitions()->getValidationError()->getValidationErrorHandler()));

        $error = new ValidationError();
        $error->setValidationErrorHandler(function ($error, $object) {
            echo '1';
        });
        $options->setValidationError($error);

        $this->assertEquals(true, is_callable($options->definitions()->getValidationError()->getValidationErrorHandler()));
    }

    public function testValidation()
    {
        $options = new SandboxOptions();
        $validation = new Validation();
        $options->setValidation($validation);
        $this->assertEquals(false, is_callable($options->validation()->getFuncValidator()));
        $validation->setFuncValidator(function ($name, $object) {
            echo $name;
        });
        $this->assertEquals(true, is_callable($options->validation()->getFuncValidator()));
    }
}
