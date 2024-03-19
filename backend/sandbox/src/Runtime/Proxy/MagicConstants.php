<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime\Proxy;

use PHPSandbox\Options\SandboxOptions;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class MagicConstants implements RuntimeProxyInterface
{
    /**
     * @static
     * @var array A static array of magic constant names used for redefining magic constant values
     */
    public static array $magic_constants = [
        '__LINE__',
        '__FILE__',
        '__DIR__',
        '__FUNCTION__',
        '__CLASS__',
        '__TRAIT__',
        '__METHOD__',
        '__NAMESPACE__',
    ];

    protected SandboxOptions $options;

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        return $this;
    }

    /** Get PHPSandbox redefined magic constant. This is an internal PHPSandbox function but requires public access to work.
     *
     * @param string $name Requested magic constant name (e.g. __FILE__, __LINE__, etc.)
     *
     * @return mixed Returns the redefined magic constant
     */
    public function _get_magic_const(string $name)
    {
        if ($this->options->definitions()->isDefinedMagicConst($name)) {
            $magic_constant = $this->options->definitions()->getDefinedMagicConst($name);
            if (is_callable($magic_constant)) {
                return call_user_func_array($magic_constant, [$this]);
            }
            return $magic_constant;
        }
        return null;
    }
}
