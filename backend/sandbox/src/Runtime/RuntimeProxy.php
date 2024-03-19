<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime;

use PHPSandbox\Error;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\Options\ValidationError;
use PHPSandbox\Parser\Closure\ReflectionClosure;
use PHPSandbox\PHPSandbox;
use PHPSandbox\Runtime\Proxy\ArgFunctions;
use PHPSandbox\Runtime\Proxy\DefinedFunctions;
use PHPSandbox\Runtime\Proxy\MagicConstants;
use PHPSandbox\Runtime\Proxy\SandboxedStringFunctions;
use PHPSandbox\Runtime\Proxy\Superglobals;
use PHPSandbox\SandboxedString;
use PHPSandbox\Validation\Validator;
use Throwable;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class RuntimeProxy
{
    protected SandboxOptions $options;

    protected ValidationError $error;

    protected Validator $validator;

    protected Superglobals $superglobals;

    protected MagicConstants $magicConstants;

    protected ArgFunctions $argFunctions;

    protected DefinedFunctions $definedFunctions;

    protected SandboxedStringFunctions $sandboxedStringFunctions;

    private string $hash;

    public function __construct(
        SandboxOptions $options,
        Validator $validator
    ) {
        $this->options = $options;
        $this->error = $this->options->getValidationError();
        $this->validator = $validator;

        $this->genHash($options);

        $this->superglobals = new Superglobals();
        $this->superglobals->setOptions($this->options);

        $this->magicConstants = new MagicConstants();
        $this->magicConstants->setOptions($this->options);

        $this->argFunctions = new ArgFunctions();
        $this->argFunctions->setOptions($this->options);

        $this->definedFunctions = new DefinedFunctions();
        $this->definedFunctions->setOptions($this->options);

        $this->sandboxedStringFunctions = new SandboxedStringFunctions();
        $this->sandboxedStringFunctions->setOptions($this->options);
    }

    public function superglobals(): Superglobals
    {
        return $this->superglobals;
    }

    public function magicConstants(): MagicConstants
    {
        return $this->magicConstants;
    }

    public function argFunctions(): ArgFunctions
    {
        return $this->argFunctions;
    }

    public function definedFunctions(): DefinedFunctions
    {
        return $this->definedFunctions;
    }

    public function sandboxedStringFunctions(): SandboxedStringFunctions
    {
        return $this->sandboxedStringFunctions;
    }

    public function getHash(): string
    {
        if (empty($this->hash)) {
            $this->genHash($this->options);
        }
        return $this->hash;
    }

    public function validator(): Validator
    {
        return $this->validator;
    }

    public function options(): SandboxOptions
    {
        return $this->options;
    }

    /** Get PHPSandbox redefined function. This is an internal PHPSandbox function but requires public access to work.
     *
     * @return mixed Returns the redefined function result
     * @throws Throwable Will throw exception if invalid function requested
     */
    public function call_func()
    {
        $arguments = func_get_args();
        $name = array_shift($arguments);
        $original_name = $name;
        $this->normalizeArguments($arguments);
        if ($this->options->definitions()->isDefinedFunc($name) && is_callable($this->options->definitions()->getDefinedFunc($name, 'function'))) {
            $function = $this->options->definitions()->getDefinedFunc($name, 'function');
            if ($this->options->definitions()->getDefinedFunc($name, 'pass_sandbox')) {            // pass the PHPSandbox instance to the defined function?
                array_unshift($arguments, $this);  // push PHPSandbox instance into first argument so user can test against it
            }
            return call_user_func_array($function, $arguments);
        }
        if (is_callable($name)) {
            return call_user_func_array($name, $arguments);
        }
        return $this->error->validationError("Sandboxed code attempted to call invalid function: {$original_name}", Error::VALID_FUNC_ERROR, null, $original_name);
    }

    public function clear(): void
    {
        $this->hash = '';
    }

    private function genHash(SandboxOptions $options): void
    {
        $append = '';
        $definedFuncs = $options->definitions()->getDefinedFunc();
        foreach ($definedFuncs as $name => $definedFunc) {
            if (isset($definedFunc['function']) && is_callable($definedFunc['function'])) {
                $ref = new ReflectionClosure($definedFunc['function']);
                $append .= $name . '@' . $ref->getCode() . '@';
            }
        }

        $this->hash = md5(var_export($options, true) . $append);
    }

    private function normalizeArguments(&$arguments): void
    {
        foreach ($arguments as &$argument) {
            if (is_array($argument)) {
                $this->normalizeArguments($argument);
            } elseif ($argument instanceof SandboxedString) {
                $argument = strval($argument);
            }
        }
    }
}
