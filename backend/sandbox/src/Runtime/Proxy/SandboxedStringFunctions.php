<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime\Proxy;

use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\SandboxedString;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class SandboxedStringFunctions implements RuntimeProxyInterface
{
    /**
     * @static
     * @var array A static array of var_dump, print_r and var_export, intval, floatval, is_string, is_object,
     *            is_scalar, is_callable, and array_key_exists for redefining those functions
     */
    public static array $sandboxed_string_funcs = [
        'var_dump',
        'print_r',
        'var_export',
        'intval',
        'floatval',
        'boolval',
        'is_string',
        'is_object',
        'is_scalar',
        'is_callable',
        'array_key_exists',
    ];

    protected SandboxOptions $options;

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        return $this;
    }

    public static function isSandboxedStringFuncs($name)
    {
        return in_array($name, self::$sandboxed_string_funcs);
    }

    /** Get PHPSandbox redefined var_dump.
     *
     */
    public function _var_dump()
    {
        $arguments = func_get_args();
        foreach ($arguments as $index => $value) {
            if ($value instanceof self) {
                unset($arguments[$index]); // hide PHPSandbox variable
            } elseif ($value instanceof SandboxedString) {
                $arguments[$index] = strval($value);
            }
        }
        return call_user_func_array('var_dump', $arguments);
    }

    /** Get PHPSandbox redefined print_r.
     *
     * @return bool|string Returns the value from print_r()
     */
    public function _print_r()
    {
        $arguments = func_get_args();
        foreach ($arguments as $index => $value) {
            if ($value instanceof self) {
                unset($arguments[$index]); // hide PHPSandbox variable
            } elseif ($value instanceof SandboxedString) {
                $arguments[$index] = strval($value);
            }
        }
        return call_user_func_array('print_r', $arguments);
    }

    /** Get PHPSandbox redefined var_export.
     *
     * @return null|string Returns the value from var_export()
     */
    public function _var_export(): ?string
    {
        $arguments = func_get_args();
        foreach ($arguments as $index => $value) {
            if ($value instanceof self) {
                unset($arguments[$index]); // hide PHPSandbox variable
            } elseif ($value instanceof SandboxedString) {
                $arguments[$index] = strval($value);
            }
        }
        return call_user_func_array('var_export', $arguments);
    }

    /** Return integer value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to return as integer
     *
     * @return int Returns the integer value
     */
    public function _intval($value): int
    {
        return intval($value instanceof SandboxedString ? strval($value) : $value);
    }

    /** Return float value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to return as float
     *
     * @return float Returns the float value
     */
    public function _floatval($value): float
    {
        return floatval($value instanceof SandboxedString ? strval($value) : $value);
    }

    /** Return boolean value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to return as boolean
     *
     * @return bool Returns the boolean value
     */
    public function _boolval($value): bool
    {
        if ($value instanceof SandboxedString) {
            return (bool) strval($value);
        }
        return is_bool($value) ? $value : (bool) $value;
    }

    /** Return array value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to return as array
     *
     * @return array Returns the array value
     */
    public function _arrayval($value): array
    {
        if ($value instanceof SandboxedString) {
            return (array) strval($value);
        }
        return is_array($value) ? $value : (array) $value;
    }

    /** Return object value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to return as object
     *
     * @return object Returns the object value
     */
    public function _objectval($value): object
    {
        if ($value instanceof SandboxedString) {
            return (object) strval($value);
        }
        return is_object($value) ? $value : (object) $value;
    }

    /** Return is_string value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to check if is_string
     *
     * @return bool Returns the is_string value
     */
    public function _is_string($value): bool
    {
        return ($value instanceof SandboxedString) ? true : is_string($value);
    }

    /** Return is_object value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to check if is_object
     *
     * @return bool Returns the is_object value
     */
    public function _is_object($value): bool
    {
        return ($value instanceof SandboxedString) ? false : is_object($value);
    }

    /** Return is_scalar value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to check if is_scalar
     *
     * @return bool Returns the is_scalar value
     */
    public function _is_scalar($value): bool
    {
        return ($value instanceof SandboxedString) ? true : is_scalar($value);
    }

    /** Return is_callable value of SandboxedString or mixed value.
     *
     * @param mixed $value Value to check if is_callable
     *
     * @return bool Returns the is_callable value
     */
    public function _is_callable($value): bool
    {
        if ($value instanceof SandboxedString) {
            $value = strval($value);
        }
        return is_callable($value);
    }

    /** Get PHPSandbox redefined array_key_exists.
     *
     * @param SandboxedString|string $key The key to check for
     * @param array $array The array to check against
     *
     * @return bool Returns the value from array_key_exists()
     */
    public function _array_key_exists($key, array $array): bool
    {
        if ($key instanceof SandboxedString) {
            $key = strval($key);
        }
        return array_key_exists($key, $array);
    }
}
