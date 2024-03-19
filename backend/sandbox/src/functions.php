<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox;

use PHPSandbox\Runtime\RuntimeProxy;

/** Wrap output value in SandboxString.
 *
 * @param mixed $value Value to wrap
 *
 * @return mixed|SandboxedString Returns the wrapped value
 */
function wrap($value, RuntimeProxy $runtimeProxy)
{
    if (! ($value instanceof SandboxedString) && is_object($value) && method_exists($value, '__toString')) {
        $strval = $value->__toString();
        return is_callable($strval) ? new SandboxedString($strval, $runtimeProxy) : $value;
    }
    if (is_array($value) && count($value)) {
        // save current array pointer
        $current_key = key($value);
        foreach ($value as $key => &$_value) {
            $value[$key] = wrap($_value, $runtimeProxy);
        }
        // rewind array pointer
        reset($value);
        // advance array to previous array key
        while (key($value) !== $current_key) {
            next($value);
        }
        return $value;
    }
    if (is_string($value) && is_callable($value)) {
        return new SandboxedString($value, $runtimeProxy);
    }
    return $value;
}

/** Wrap output value in SandboxString by reference.
 *
 * @param mixed $value Value to wrap
 *
 * @return mixed|SandboxedString Returns the wrapped value
 */
function &wrapByRef(&$value, RuntimeProxy $runtimeProxy)
{
    if (! ($value instanceof SandboxedString) && is_object($value) && method_exists($value, '__toString')) {
        $strVal = $value->__toString();
        if (is_callable($strVal)) {
            $value = new SandboxedString($strVal, $runtimeProxy);
        }
    } elseif (is_array($value) && count($value)) {
        // save current array pointer
        $current_key = key($value);
        foreach ($value as $key => &$_value) {
            $value[$key] = wrap($_value, $runtimeProxy);
        }
        // rewind array pointer
        reset($value);
        // advance array to saved array pointer
        while (key($value) !== $current_key) {
            next($value);
        }
    } elseif (is_string($value) && is_callable($value)) {
        $value = new SandboxedString($value, $runtimeProxy);
    }
    return $value;
}
