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
class Superglobals implements RuntimeProxyInterface
{
    /**
     * @static
     * @var array A static array of superglobal names used for redefining superglobal values
     */
    public static array $superglobals = [
        '_GET',
        '_POST',
        '_COOKIE',
        '_FILES',
        '_ENV',
        '_REQUEST',
        '_SERVER',
        '_SESSION',
        'GLOBALS',
    ];

    protected SandboxOptions $options;

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        return $this;
    }

    /** Get PHPSandbox redefined superglobal. This is an internal PHPSandbox function but requires public access to work.
     *
     * @param string $name Requested superglobal name (e.g. _GET, _POST, etc.)
     *
     * @return array Returns the redefined superglobal
     */
    public function _get_superglobal(string $name): array
    {
        $original_name = strtoupper($name);
        if ($this->options->definitions()->isDefinedSuperglobal($name)) {
            $superglobal = $this->options->definitions()->getDefinedSuperglobals($name);
            if (is_callable($superglobal)) {
                return call_user_func_array($superglobal, [$this]);
            }
            return $superglobal;
        }
        if ($this->options->accessControl()->isWhitelistedSuperglobal($name)) {
            if ($this->options->accessControl()->hasWhitelistedSuperglobals($name)) {
                if (isset($GLOBALS[$original_name])) {
                    $whitelisted_superglobal = [];
                    foreach ($this->options->accessControl()->getWhitelistedSuperglobal($name) as $key => $value) {
                        if (isset($GLOBALS[$original_name][$key])) {
                            $whitelisted_superglobal[$key] = $GLOBALS[$original_name][$key];
                        }
                    }
                    return $whitelisted_superglobal;
                }
            } elseif (isset($GLOBALS[$original_name])) {
                return $GLOBALS[$original_name];
            }
        } elseif ($this->options->accessControl()->isBlacklistedSuperglobal($name)) {
            if ($this->options->accessControl()->hasBlacklistedSuperglobals($name)) {
                if (isset($GLOBALS[$original_name])) {
                    $blacklisted_superglobal = $GLOBALS[$original_name];
                    foreach ($this->options->accessControl()->getBlacklistedSuperglobal($name) as $key => $value) {
                        if (isset($blacklisted_superglobal[$key])) {
                            unset($blacklisted_superglobal[$key]);
                        }
                    }
                    return $blacklisted_superglobal;
                }
            }
        }
        return [];
    }
}
