<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime\Proxy;

use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class ArgFunctions implements RuntimeProxyInterface
{
    /**
     * @static
     * @var array A static array of func_get_args, func_get_arg, and func_num_args used for redefining those functions
     */
    public static array $arg_funcs = [
        'func_get_args',
        'func_get_arg',
        'func_num_args',
    ];

    protected SandboxOptions $options;

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        return $this;
    }

    public static function isArgFuncs($name)
    {
        return in_array($name, self::$arg_funcs);
    }

    /** Get PHPSandbox redefined function arguments array.
     *
     * @param array $arguments Array result from func_get_args() is passed here
     *
     * @return array Returns the redefined arguments array
     */
    public function _func_get_args(array $arguments = []): array
    {
        foreach ($arguments as $index => $value) {
            if ($value instanceof PHPSandbox) {
                unset($arguments[$index]); // hide PHPSandbox variable
            }
        }
        return $arguments;
    }

    /** Get PHPSandbox redefined function argument.
     *
     * @param array $arguments Array result from func_get_args() is passed here
     *
     * @param int $index Requested func_get_arg index is passed here
     *
     * @return mixed Returns the redefined argument
     */
    public function _func_get_arg(array $arguments = [], int $index = 0)
    {
        if ($arguments[$index] instanceof PHPSandbox) {
            ++$index;   // get next argument instead
        }
        return isset($arguments[$index]) && ! ($arguments[$index] instanceof PHPSandbox) ? $arguments[$index] : null;
    }

    /** Get PHPSandbox redefined number of function arguments.
     *
     * @param array $arguments Array result from func_get_args() is passed here
     *
     * @return int Returns the redefined number of function arguments
     */
    public function _func_num_args(array $arguments = []): int
    {
        $count = count($arguments);
        foreach ($arguments as $argument) {
            if ($argument instanceof PHPSandbox) {
                --$count;
            }
        }
        return $count > 0 ? $count : 0;
    }
}
