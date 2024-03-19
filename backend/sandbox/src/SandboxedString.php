<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox;

use ArrayAccess;
use ArrayIterator;
use IteratorAggregate;
use JsonSerializable;
use PHPSandbox\Runtime\Proxy\ArgFunctions;
use PHPSandbox\Runtime\Proxy\DefinedFunctions;
use PHPSandbox\Runtime\Proxy\SandboxedStringFunctions;
use PHPSandbox\Runtime\RuntimeProxy;
use Throwable;

/**
 * Sandboxed string class for PHP Sandboxes.
 *
 * This class wraps sandboxed strings to intercept and check callable invocations
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 */
class SandboxedString implements ArrayAccess, IteratorAggregate, JsonSerializable
{
    /** Value of the SandboxedString.
     */
    private string $value;

    private RuntimeProxy $runtimeProxy;

    public function __construct(string $value, RuntimeProxy $runtimeProxy)
    {
        $this->value = $value;
        $this->runtimeProxy = $runtimeProxy;
    }

    /** Returns the original string value.
     */
    public function __toString(): string
    {
        return $this->value;
    }

    /** Checks the string value against the sandbox function whitelists and blacklists for callback violations.
     *
     * @throws Throwable
     */
    public function __invoke(): string
    {
        if ($this->runtimeProxy->validator()->checkFunc($this->value)) {
            $name = strtolower($this->value);
            if (SandboxedStringFunctions::isSandboxedStringFuncs($name) && $this->runtimeProxy->options()->isOverwriteSandboxedStringFuncs()
            ) {
                return call_user_func_array([$this->runtimeProxy->sandboxedStringFunctions(), '_' . $this->value], func_get_args());
            }
            if (DefinedFunctions::isDefinedFunc($name) && $this->runtimeProxy->options()->isOverwriteDefinedFuncs()) {
                return call_user_func_array([$this->runtimeProxy->definedFunctions(), '_' . $this->value], func_get_args());
            }
            if (ArgFunctions::isArgFuncs($name) && $this->runtimeProxy->options()->isOverwriteFuncGetArgs()) {
                return call_user_func_array([$this->runtimeProxy->argFunctions(), '_' . $this->value], func_get_args());
            }
            return call_user_func_array($name, func_get_args());
        }
        return '';
    }

    /** Set string value at specified offset.
     * @param mixed $offset Offset to set value
     * @param mixed $value Value to set
     */
    public function offsetSet($offset, $value): void
    {
        if ($offset === null) {
            $this->value .= $value;
        } else {
            $this->value[$offset] = $value;
        }
    }

    /** Get string value at specified offset.
     * @param mixed $offset Offset to get value
     *
     * @return string Value to return
     */
    public function offsetGet($offset): string
    {
        return $this->value[$offset];
    }

    /** Check if specified offset exists in string value.
     * @param mixed $offset Offset to check
     *
     * @return bool Return true if offset exists, false otherwise
     */
    public function offsetExists($offset): bool
    {
        return isset($this->value[$offset]);
    }

    /** Unset string value at specified offset.
     * @param mixed $offset Offset to unset
     */
    public function offsetUnset($offset): void
    {
        unset($this->value[$offset]);
    }

    /** Return iterator for string value.
     * @return ArrayIterator Array iterator to return
     */
    public function getIterator(): ArrayIterator
    {
        return new ArrayIterator(str_split($this->value));
    }

    public function jsonSerialize(): string
    {
        return $this->value;
    }
}
