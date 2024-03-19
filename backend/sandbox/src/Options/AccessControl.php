<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

use PHPSandbox\Constants\KeywordConstants;

class AccessControl
{
    use NormalizeTrait;

    /**
     * @var array Array of whitelisted functions, classes, etc. If an array type contains elements, then it overrides its blacklist counterpart
     */
    protected array $whitelist = [
        KeywordConstants::FUNCTION => [],
        KeywordConstants::VARIABLES => [],
        KeywordConstants::GLOBALS => [],
        KeywordConstants::SUPERGLOBALS => [],
        KeywordConstants::CONSTANTS => [],
        KeywordConstants::MAGIC_CONSTANTS => [],
        KeywordConstants::NAMESPACES => [],
        KeywordConstants::ALIASES => [],
        KeywordConstants::CLASSES => [],
        KeywordConstants::INTERFACES => [],
        KeywordConstants::TRAITS => [],
        KeywordConstants::KEYWORDS => [],
        KeywordConstants::OPERATORS => [],
        KeywordConstants::PRIMITIVES => [],
        KeywordConstants::TYPES => [],
    ];

    /**
     * @var array Array of blacklisted functions, classes, etc. Any whitelisted array types override their counterpart in this array
     */
    protected array $blacklist = [
        KeywordConstants::FUNCTION => [],
        KeywordConstants::VARIABLES => [],
        KeywordConstants::GLOBALS => [],
        KeywordConstants::SUPERGLOBALS => [],
        KeywordConstants::CONSTANTS => [],
        KeywordConstants::MAGIC_CONSTANTS => [],
        KeywordConstants::NAMESPACES => [],
        KeywordConstants::ALIASES => [],
        KeywordConstants::CLASSES => [],
        KeywordConstants::INTERFACES => [],
        KeywordConstants::TRAITS => [],
        KeywordConstants::KEYWORDS => [
            'declare' => true,
            'eval' => true,
            'exit' => true,
            'halt' => true,
        ],
        KeywordConstants::OPERATORS => [],
        KeywordConstants::PRIMITIVES => [],
        KeywordConstants::TYPES => [],
    ];

    /** Whitelist PHPSandbox definitions, such as functions, constants, classes, etc. to set.
     *
     * You can pass an associative array of whitelist types and their names, or a string $type and array of $names, or pass a string of the $type and $name
     *
     * @param array|string $type Associative array or string of whitelist type to set
     * @param null|array|string $name Array or string of whitelist name to set
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelist($type, $name = null): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (is_string($name) && $name && isset($this->whitelist[$_type])) {
                    $this->whitelist[$_type][$name] = true;
                } elseif (isset($this->whitelist[$_type]) && is_array($name)) {
                    foreach ($name as $_name) {
                        if (is_string($_name) && $_name) {
                            $this->whitelist[$_type][$_name] = true;
                        }
                    }
                }
            }
        } elseif (isset($this->whitelist[$type]) && is_array($name)) {
            foreach ($name as $_name) {
                if (is_string($_name) && $_name) {
                    $this->whitelist[$type][$_name] = true;
                }
            }
        } elseif (is_string($name) && $name && isset($this->whitelist[$type])) {
            $this->whitelist[$type][$name] = true;
        }
        return $this;
    }

    /** Blacklist PHPSandbox definitions, such as functions, constants, classes, etc. to set.
     *
     * You can pass an associative array of blacklist types and their names, or a string $type and array of $names, or pass a string of the $type and $name
     *
     * @param array|string $type Associative array or string of blacklist type to set
     * @param null|array|string $name Array or string of blacklist name to set
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklist($type, $name = null): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (is_string($name) && $name && isset($this->blacklist[$_type])) {
                    $this->blacklist[$_type][$name] = true;
                } elseif (isset($this->blacklist[$_type]) && is_array($name)) {
                    foreach ($name as $_name) {
                        if (is_string($_name) && $_name) {
                            $this->blacklist[$_type][$_name] = true;
                        }
                    }
                }
            }
        } elseif (isset($this->blacklist[$type]) && is_array($name)) {
            foreach ($name as $_name) {
                if (is_string($_name) && $_name) {
                    $this->blacklist[$type][$_name] = true;
                }
            }
        } elseif (is_string($name) && $name && isset($this->blacklist[$type])) {
            $this->blacklist[$type][$name] = true;
        }
        return $this;
    }

    /** Remove PHPSandbox definitions, such as functions, constants, classes, etc. from whitelist.
     *
     * You can pass an associative array of whitelist types and their names, or a string $type and array of $names, or pass a string of the $type and $name to unset
     *
     * @param array|string $type Associative array or string of whitelist type to unset
     * @param null|array|string $name Array or string of whitelist name to unset
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelist($type, $name): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (isset($this->whitelist[$_type]) && is_string($name) && $name && isset($this->whitelist[$_type][$name])) {
                    unset($this->whitelist[$_type][$name]);
                } elseif (isset($this->whitelist[$_type]) && is_array($name)) {
                    foreach ($name as $_name) {
                        if (is_string($_name) && $_name && isset($this->whitelist[$_type][$_name])) {
                            unset($this->whitelist[$_type][$_name]);
                        }
                    }
                }
            }
        } elseif (isset($this->whitelist[$type]) && is_string($name) && $name && isset($this->whitelist[$type][$name])) {
            unset($this->whitelist[$type][$name]);
        }
        return $this;
    }

    /** Remove PHPSandbox definitions, such as functions, constants, classes, etc. from blacklist.
     *
     * You can pass an associative array of blacklist types and their names, or a string $type and array of $names, or pass a string of the $type and $name to unset
     *
     * @param array|string $type Associative array or string of blacklist type to unset
     * @param null|array|string $name Array or string of blacklist name to unset
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklist($type, $name): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (isset($this->blacklist[$_type]) && is_string($name) && $name && isset($this->blacklist[$_type][$name])) {
                    unset($this->blacklist[$_type][$name]);
                } elseif (isset($this->blacklist[$_type]) && is_array($name)) {
                    foreach ($name as $_name) {
                        if (is_string($_name) && $_name && isset($this->blacklist[$_type][$_name])) {
                            unset($this->blacklist[$_type][$_name]);
                        }
                    }
                }
            }
        } elseif (isset($this->blacklist[$type]) && is_string($name) && $name && isset($this->blacklist[$type][$name])) {
            unset($this->blacklist[$type][$name]);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has whitelist type.
     *
     * @param string $type The whitelist type to query
     *
     * @return int Returns the number of whitelists this instance has defined
     */
    public function hasWhitelist(string $type): int
    {
        return count($this->whitelist[$type]);
    }

    /** Query whether PHPSandbox instance has blacklist type.
     *
     * @param string $type The blacklist type to query
     *
     * @return int Returns the number of blacklists this instance has defined
     */
    public function hasBlacklist(string $type): int
    {
        return count($this->blacklist[$type]);
    }

    /** Check if PHPSandbox instance has whitelist type and name set.
     *
     * @param string $type String of whitelist $type to query
     * @param string $name String of whitelist $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted $type and $name, false otherwise
     */
    public function isWhitelisted(string $type, string $name): bool
    {
        return isset($this->whitelist[$type][$name]);
    }

    /** Check if PHPSandbox instance has blacklist type and name set.
     *
     * @param string $type String of blacklist $type to query
     * @param string $name String of blacklist $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted $type and $name, false otherwise
     */
    public function isBlacklisted(string $type, string $name): bool
    {
        return isset($this->blacklist[$type][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted functions.
     *
     * @return int Returns the number of whitelisted functions this instance has defined
     */
    public function hasWhitelistedFuncs(): int
    {
        return count($this->whitelist[KeywordConstants::FUNCTION]);
    }

    /** Query whether PHPSandbox instance has blacklisted functions.
     *
     * @return int Returns the number of blacklisted functions this instance has defined
     */
    public function hasBlacklistedFuncs(): int
    {
        return count($this->blacklist[KeywordConstants::FUNCTION]);
    }

    /** Check if PHPSandbox instance has whitelisted function name set.
     *
     * @param string $name String of function $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted function $name, false otherwise
     */
    public function isWhitelistedFunc(string $name): bool
    {
        $name = $this->normalizeFunc($name);
        return isset($this->whitelist[KeywordConstants::FUNCTION][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted function name set.
     *
     * @param string $name String of function $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted function $name, false otherwise
     */
    public function isBlacklistedFunc(string $name): bool
    {
        $name = $this->normalizeFunc($name);
        return isset($this->blacklist[KeywordConstants::FUNCTION][$name]);
    }

    public function getWhitelistedFunc(?string $name = null): mixed
    {
        if (! $name) {
            return $this->whitelist[KeywordConstants::FUNCTION];
        }
        $name = $this->normalizeFunc($name);
        return $this->whitelist[KeywordConstants::FUNCTION][$name] ?? null;
    }

    /** Query whether PHPSandbox instance has whitelisted variables.
     *
     * @return int Returns the number of whitelisted variables this instance has defined
     */
    public function hasWhitelistedVars(): int
    {
        return count($this->whitelist[KeywordConstants::VARIABLES]);
    }

    /** Query whether PHPSandbox instance has blacklisted variables.
     *
     * @return int Returns the number of blacklisted variables this instance has defined
     */
    public function hasBlacklistedVars(): int
    {
        return count($this->blacklist[KeywordConstants::VARIABLES]);
    }

    /** Check if PHPSandbox instance has whitelisted variable name set.
     *
     * @param string $name String of variable $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted variable $name, false otherwise
     */
    public function isWhitelistedVar(string $name): bool
    {
        return isset($this->whitelist[KeywordConstants::VARIABLES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted variable name set.
     *
     * @param string $name String of variable $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted variable $name, false otherwise
     */
    public function isBlacklistedVar(string $name): bool
    {
        return isset($this->blacklist[KeywordConstants::VARIABLES][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted globals.
     *
     * @return int Returns the number of whitelisted globals this instance has defined
     */
    public function hasWhitelistedGlobals(): int
    {
        return count($this->whitelist[KeywordConstants::GLOBALS]);
    }

    /** Query whether PHPSandbox instance has blacklisted globals.
     *
     * @return int Returns the number of blacklisted globals this instance has defined
     */
    public function hasBlacklistedGlobals(): int
    {
        return count($this->blacklist[KeywordConstants::GLOBALS]);
    }

    /** Check if PHPSandbox instance has whitelisted global name set.
     *
     * @param string $name String of global $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted global $name, false otherwise
     */
    public function isWhitelistedGlobal(string $name): bool
    {
        return isset($this->whitelist[KeywordConstants::GLOBALS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted global name set.
     *
     * @param string $name String of global $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted global $name, false otherwise
     */
    public function isBlacklistedGlobal(string $name): bool
    {
        return isset($this->blacklist[KeywordConstants::GLOBALS][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted superglobals, or superglobal keys.
     *
     * @param null|string $name The whitelist superglobal key to query
     *
     * @return int Returns the number of whitelisted superglobals or superglobal keys this instance has defined
     */
    public function hasWhitelistedSuperglobals(?string $name = null): int
    {
        if (! $name) {
            return count($this->whitelist[KeywordConstants::SUPERGLOBALS]);
        }
        $name = $this->normalizeSuperglobal($name);
        if (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name])) {
            return count($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]);
        }
        return 0;
    }

    /** Query whether PHPSandbox instance has blacklisted superglobals, or superglobal keys.
     *
     * @param null|string $name The blacklist superglobal key to query
     *
     * @return int Returns the number of blacklisted superglobals or superglobal keys this instance has defined
     */
    public function hasBlacklistedSuperglobals(?string $name = null): int
    {
        if (! $name) {
            return count($this->blacklist[KeywordConstants::SUPERGLOBALS]);
        }
        $name = $this->normalizeSuperglobal($name);
        if (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name])) {
            return count($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]);
        }
        return 0;
    }

    /** Check if PHPSandbox instance has whitelisted superglobal or superglobal key set.
     *
     * @param string $name String of whitelisted superglobal $name to query
     * @param null|string $key String of whitelisted superglobal $key to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted superglobal key or superglobal, false otherwise
     */
    public function isWhitelistedSuperglobal(string $name, ?string $key = null): bool
    {
        $name = $this->normalizeSuperglobal($name);
        return $key !== null ? isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$key]) : isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted superglobal or superglobal key set.
     *
     * @param string $name String of blacklisted superglobal $name to query
     * @param null|string $key String of blacklisted superglobal $key to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted superglobal key or superglobal, false otherwise
     */
    public function isBlacklistedSuperglobal(string $name, ?string $key = null): bool
    {
        $name = $this->normalizeSuperglobal($name);
        return $key !== null ? isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$key]) : isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]);
    }

    public function getWhitelistedSuperglobal(string $name): mixed
    {
        $name = $this->normalizeSuperglobal($name);
        return $this->whitelist[KeywordConstants::SUPERGLOBALS][$name] ?? [];
    }

    public function getBlacklistedSuperglobal(string $name): mixed
    {
        $name = $this->normalizeSuperglobal($name);
        return $this->blacklist[KeywordConstants::SUPERGLOBALS][$name] ?? [];
    }

    /** Query whether PHPSandbox instance has whitelisted constants.
     *
     * @return int Returns the number of whitelisted constants this instance has defined
     */
    public function hasWhitelistedConsts(): int
    {
        return count($this->whitelist[KeywordConstants::CONSTANTS]);
    }

    /** Query whether PHPSandbox instance has blacklisted constants.
     *
     * @return int Returns the number of blacklisted constants this instance has defined
     */
    public function hasBlacklistedConsts(): int
    {
        return count($this->blacklist[KeywordConstants::CONSTANTS]);
    }

    /** Check if PHPSandbox instance has whitelisted constant name set.
     *
     * @param string $name String of constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted constant $name, false otherwise
     */
    public function isWhitelistedConst(string $name): bool
    {
        return isset($this->whitelist[KeywordConstants::CONSTANTS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted constant name set.
     *
     * @param string $name String of constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted constant $name, false otherwise
     */
    public function isBlacklistedConst(string $name): bool
    {
        return isset($this->blacklist[KeywordConstants::CONSTANTS][$name]);
    }

    public function getWhitelistedConst(?string $name = null): mixed
    {
        if (! $name) {
            return $this->whitelist[KeywordConstants::CONSTANTS];
        }
        return $this->whitelist[KeywordConstants::CONSTANTS][$name];
    }

    public function getBlacklistedConst(?string $name = null): mixed
    {
        if (! $name) {
            return $this->blacklist[KeywordConstants::CONSTANTS];
        }
        return $this->blacklist[KeywordConstants::CONSTANTS][$name];
    }

    /** Query whether PHPSandbox instance has whitelisted magic constants.
     *
     * @return int Returns the number of whitelisted magic constants this instance has defined
     */
    public function hasWhitelistedMagicConsts(): int
    {
        return count($this->whitelist[KeywordConstants::MAGIC_CONSTANTS]);
    }

    /** Query whether PHPSandbox instance has blacklisted magic constants.
     *
     * @return int Returns the number of blacklisted magic constants this instance has defined
     */
    public function hasBlacklistedMagicConsts(): int
    {
        return count($this->blacklist[KeywordConstants::MAGIC_CONSTANTS]);
    }

    /** Check if PHPSandbox instance has whitelisted magic constant name set.
     *
     * @param string $name String of magic constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted magic constant $name, false otherwise
     */
    public function isWhitelistedMagicConst(string $name): bool
    {
        $name = $this->normalizeMagicConst($name);
        return isset($this->whitelist[KeywordConstants::MAGIC_CONSTANTS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted magic constant name set.
     *
     * @param string $name String of magic constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted magic constant $name, false otherwise
     */
    public function isBlacklistedMagicConst(string $name): bool
    {
        $name = $this->normalizeMagicConst($name);
        return isset($this->blacklist[KeywordConstants::MAGIC_CONSTANTS][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted namespaces.
     *
     * @return int Returns the number of whitelisted namespaces this instance has defined
     */
    public function hasWhitelistedNamespaces(): int
    {
        return count($this->whitelist[KeywordConstants::NAMESPACES]);
    }

    /** Query whether PHPSandbox instance has blacklisted namespaces.
     *
     * @return int Returns the number of blacklisted namespaces this instance has defined
     */
    public function hasBlacklistedNamespaces(): int
    {
        return count($this->blacklist[KeywordConstants::NAMESPACES]);
    }

    /** Check if PHPSandbox instance has whitelisted namespace name set.
     *
     * @param string $name String of namespace $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted namespace $name, false otherwise
     */
    public function isWhitelistedNamespace(string $name): bool
    {
        $name = $this->normalizeNamespace($name);
        return isset($this->whitelist[KeywordConstants::NAMESPACES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted namespace name set.
     *
     * @param string $name String of namespace $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted namespace $name, false otherwise
     */
    public function isBlacklistedNamespace(string $name): bool
    {
        $name = $this->normalizeNamespace($name);
        return isset($this->blacklist[KeywordConstants::NAMESPACES][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted aliases.
     *
     * @return int Returns the number of whitelisted aliases this instance has defined
     */
    public function hasWhitelistedAliases(): int
    {
        return count($this->whitelist[KeywordConstants::ALIASES]);
    }

    /** Query whether PHPSandbox instance has blacklisted aliases.
     *
     * @return int Returns the number of blacklisted aliases this instance has defined
     */
    public function hasBlacklistedAliases(): int
    {
        return count($this->blacklist[KeywordConstants::ALIASES]);
    }

    /** Check if PHPSandbox instance has whitelisted alias name set.
     *
     * @param string $name String of alias $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted alias $name, false otherwise
     */
    public function isWhitelistedAlias(string $name): bool
    {
        $name = $this->normalizeAlias($name);
        return isset($this->whitelist[KeywordConstants::ALIASES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted alias name set.
     *
     * @param string $name String of alias $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted alias $name, false otherwise
     */
    public function isBlacklistedAlias(string $name): bool
    {
        $name = $this->normalizeAlias($name);
        return isset($this->blacklist[KeywordConstants::ALIASES][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted uses (or aliases.).
     *
     * @alias   hasWhitelistedAliases();
     *
     * @return int Returns the number of whitelisted uses (or aliases) this instance has defined
     */
    public function hasWhitelistedUses(): int
    {
        return $this->hasWhitelistedAliases();
    }

    /** Query whether PHPSandbox instance has blacklisted uses (or aliases.).
     *
     * @alias   hasBlacklistedAliases();
     *
     * @return int Returns the number of blacklisted uses (or aliases) this instance has defined
     */
    public function hasBlacklistedUses(): int
    {
        return $this->hasBlacklistedAliases();
    }

    /** Check if PHPSandbox instance has whitelisted use (or alias) name set.
     *
     * @alias   isWhitelistedAlias();
     *
     * @param string $name String of use (or alias) $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted use (or alias) $name, false otherwise
     */
    public function isWhitelistedUse(string $name): bool
    {
        return $this->isWhitelistedAlias($name);
    }

    /** Check if PHPSandbox instance has blacklisted use (or alias) name set.
     *
     * @alias   isBlacklistedAlias();
     *
     * @param string $name String of use (or alias) $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted use (or alias) $name, false otherwise
     */
    public function isBlacklistedUse(string $name): bool
    {
        return $this->isBlacklistedAlias($name);
    }

    /** Query whether PHPSandbox instance has whitelisted classes.
     *
     * @return int Returns the number of whitelisted classes this instance has defined
     */
    public function hasWhitelistedClasses(): int
    {
        return count($this->whitelist[KeywordConstants::CLASSES]);
    }

    /** Query whether PHPSandbox instance has blacklisted classes.
     *
     * @return int Returns the number of blacklisted classes this instance has defined
     */
    public function hasBlacklistedClasses(): int
    {
        return count($this->blacklist[KeywordConstants::CLASSES]);
    }

    /** Check if PHPSandbox instance has whitelisted class name set.
     *
     * @param string $name String of class $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted class $name, false otherwise
     */
    public function isWhitelistedClass(string $name): bool
    {
        $name = $this->normalizeClass($name);
        return isset($this->whitelist[KeywordConstants::CLASSES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted class name set.
     *
     * @param string $name String of class $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted class $name, false otherwise
     */
    public function isBlacklistedClass(string $name): bool
    {
        $name = $this->normalizeClass($name);
        return isset($this->blacklist[KeywordConstants::CLASSES][$name]);
    }

    public function getWhitelistedClass(?string $name = null): mixed
    {
        if (! $name) {
            return $this->whitelist[KeywordConstants::CLASSES];
        }
        $name = $this->normalizeClass($name);
        return $this->whitelist[KeywordConstants::CLASSES][$name];
    }

    public function getBlacklistedClass(?string $name = null): mixed
    {
        if (! $name) {
            return $this->blacklist[KeywordConstants::CLASSES];
        }
        $name = $this->normalizeClass($name);
        return $this->blacklist[KeywordConstants::CLASSES][$name];
    }

    /** Query whether PHPSandbox instance has whitelisted interfaces.
     *
     * @return int Returns the number of whitelisted interfaces this instance has defined
     */
    public function hasWhitelistedInterfaces(): int
    {
        return count($this->whitelist[KeywordConstants::INTERFACES]);
    }

    public function getWhitelistedInterfaces(?string $name = null): mixed
    {
        if (! $name) {
            return $this->whitelist[KeywordConstants::INTERFACES];
        }
        $name = $this->normalizeInterface($name);
        return $this->whitelist[KeywordConstants::INTERFACES][$name];
    }

    /** Query whether PHPSandbox instance has blacklisted interfaces.
     *
     * @return int Returns the number of blacklisted interfaces this instance has defined
     */
    public function hasBlacklistedInterfaces(): int
    {
        return count($this->blacklist[KeywordConstants::INTERFACES]);
    }

    /** Check if PHPSandbox instance has whitelisted interface name set.
     *
     * @param string $name String of interface $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted interface $name, false otherwise
     */
    public function isWhitelistedInterface(string $name): bool
    {
        $name = $this->normalizeInterface($name);
        return isset($this->whitelist[KeywordConstants::INTERFACES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted interface name set.
     *
     * @param string $name String of interface $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted interface $name, false otherwise
     */
    public function isBlacklistedInterface(string $name): bool
    {
        $name = $this->normalizeInterface($name);
        return isset($this->blacklist[KeywordConstants::INTERFACES][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted traits.
     *
     * @return int Returns the number of whitelisted traits this instance has defined
     */
    public function hasWhitelistedTraits(): int
    {
        return count($this->whitelist[KeywordConstants::TRAITS]);
    }

    public function getWhitelistedTraits(?string $name = null): mixed
    {
        if ($name === null) {
            return $this->whitelist[KeywordConstants::TRAITS];
        }
        $name = $this->normalizeTrait($name);
        return $this->whitelist[KeywordConstants::TRAITS][$name];
    }

    /** Query whether PHPSandbox instance has blacklisted traits.
     *
     * @return int Returns the number of blacklisted traits this instance has defined
     */
    public function hasBlacklistedTraits(): int
    {
        return count($this->blacklist[KeywordConstants::TRAITS]);
    }

    /** Check if PHPSandbox instance has whitelisted trait name set.
     *
     * @param string $name String of trait $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted trait $name, false otherwise
     */
    public function isWhitelistedTrait(string $name): bool
    {
        $name = $this->normalizeTrait($name);
        return isset($this->whitelist[KeywordConstants::TRAITS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted trait name set.
     *
     * @param string $name String of trait $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted trait $name, false otherwise
     */
    public function isBlacklistedTrait(string $name): bool
    {
        $name = $this->normalizeTrait($name);
        return isset($this->blacklist[KeywordConstants::TRAITS][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted keywords.
     *
     * @return int Returns the number of whitelisted keywords this instance has defined
     */
    public function hasWhitelistKeywords(): int
    {
        return count($this->whitelist[KeywordConstants::KEYWORDS]);
    }

    /** Query whether PHPSandbox instance has blacklisted keywords.
     *
     * @return int Returns the number of blacklisted keywords this instance has defined
     */
    public function hasBlacklistedKeywords(): int
    {
        return count($this->blacklist[KeywordConstants::KEYWORDS]);
    }

    /** Check if PHPSandbox instance has whitelisted keyword name set.
     *
     * @param string $name String of keyword $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted keyword $name, false otherwise
     */
    public function isWhitelistedKeyword(string $name): bool
    {
        $name = $this->normalizeKeyword($name);
        return isset($this->whitelist[KeywordConstants::KEYWORDS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted keyword name set.
     *
     * @param string $name String of keyword $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted keyword $name, false otherwise
     */
    public function isBlacklistedKeyword(string $name): bool
    {
        $name = $this->normalizeKeyword($name);
        return isset($this->blacklist[KeywordConstants::KEYWORDS][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted operators.
     *
     * @return int Returns the number of whitelisted operators this instance has defined
     */
    public function hasWhitelistedOperators(): int
    {
        return count($this->whitelist[KeywordConstants::OPERATORS]);
    }

    /** Query whether PHPSandbox instance has blacklisted operators.
     *
     * @return int Returns the number of blacklisted operators this instance has defined
     */
    public function hasBlacklistedOperators(): int
    {
        return count($this->blacklist[KeywordConstants::OPERATORS]);
    }

    /** Check if PHPSandbox instance has whitelisted operator name set.
     *
     * @param string $name String of operator $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted operator $name, false otherwise
     */
    public function isWhitelistedOperator(string $name): bool
    {
        $name = $this->normalizeOperator($name);
        return isset($this->whitelist[KeywordConstants::OPERATORS][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted operator name set.
     *
     * @param string $name String of operator $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted operator $name, false otherwise
     */
    public function isBlacklistedOperator(string $name): bool
    {
        $name = $this->normalizeOperator($name);
        return isset($this->blacklist[KeywordConstants::OPERATORS][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted primitives.
     *
     * @return int Returns the number of whitelisted primitives this instance has defined
     */
    public function hasWhitelistedPrimitives(): int
    {
        return count($this->whitelist[KeywordConstants::PRIMITIVES]);
    }

    /** Query whether PHPSandbox instance has blacklisted primitives.
     *
     * @return int Returns the number of blacklisted primitives this instance has defined
     */
    public function hasBlacklistedPrimitives(): int
    {
        return count($this->blacklist[KeywordConstants::PRIMITIVES]);
    }

    /** Check if PHPSandbox instance has whitelisted primitive name set.
     *
     * @param string $name String of primitive $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted primitive $name, false otherwise
     */
    public function isWhitelistedPrimitive(string $name): bool
    {
        $name = $this->normalizePrimitive($name);
        return isset($this->whitelist[KeywordConstants::PRIMITIVES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted primitive name set.
     *
     * @param string $name String of primitive $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted primitive $name, false otherwise
     */
    public function isBlacklistedPrimitive(string $name): bool
    {
        $name = $this->normalizePrimitive($name);
        return isset($this->blacklist[KeywordConstants::PRIMITIVES][$name]);
    }

    /** Query whether PHPSandbox instance has whitelisted types.
     *
     * @return int Returns the number of whitelisted types this instance has defined
     */
    public function hasWhitelistedTypes(): int
    {
        return count($this->whitelist[KeywordConstants::TYPES]);
    }

    /** Query whether PHPSandbox instance has blacklisted types.
     *
     * @return int Returns the number of blacklisted types this instance has defined
     */
    public function hasBlacklistedTypes(): int
    {
        return count($this->blacklist[KeywordConstants::TYPES]);
    }

    /** Check if PHPSandbox instance has whitelisted type name set.
     *
     * @param string $name String of type $name to query
     *
     * @return bool Returns true if PHPSandbox instance has whitelisted type $name, false otherwise
     */
    public function isWhitelistedType(string $name): bool
    {
        $name = $this->normalizeType($name);
        return isset($this->whitelist[KeywordConstants::TYPES][$name]);
    }

    /** Check if PHPSandbox instance has blacklisted type name set.
     *
     * @param string $name String of type $name to query
     *
     * @return bool Returns true if PHPSandbox instance has blacklisted type $name, false otherwise
     */
    public function isBlacklistedType(string $name): bool
    {
        $name = $this->normalizeType($name);
        return isset($this->blacklist[KeywordConstants::TYPES][$name]);
    }

    /** Whitelist function.
     *
     * You can pass a string of the function name, or pass an array of function names to whitelist
     *
     * @param array|string $name String of function name, or array of function names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistFunc($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistFunc(func_get_args());
        }
        $name = $this->normalizeFunc($name);
        return $this->whitelist(KeywordConstants::FUNCTION, $name);
    }

    /** Blacklist function.
     *
     * You can pass a string of the function name, or pass an array of function names to blacklist
     *
     * @param array|string $name String of function name, or array of function names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistFunc($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistFunc(func_get_args());
        }
        $name = $this->normalizeFunc($name);
        return $this->blacklist(KeywordConstants::FUNCTION, $name);
    }

    /** Remove function from whitelist.
     *
     * You can pass a string of the function name, or pass an array of function names to remove from whitelist
     *
     * @param array|string $name String of function name or array of function names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistFunc($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistFunc(func_get_args());
        }
        $name = $this->normalizeFunc($name);
        return $this->dewhitelist(KeywordConstants::FUNCTION, $name);
    }

    /** Remove function from blacklist.
     *
     * You can pass a string of the function name, or pass an array of function names to remove from blacklist
     *
     * @param array|string $name String of function name or array of function names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistFunc($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistFunc(func_get_args());
        }
        $name = $this->normalizeFunc($name);
        return $this->deblacklist(KeywordConstants::FUNCTION, $name);
    }

    /** Whitelist variable.
     *
     * You can pass a string of variable name, or pass an array of the variable names to whitelist
     *
     * @param array|string $name String of variable name or array of variable names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistVar($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistVar(func_get_args());
        }
        return $this->whitelist(KeywordConstants::VARIABLES, $name);
    }

    /** Blacklist variable.
     *
     * You can pass a string of variable name, or pass an array of the variable names to blacklist
     *
     * @param array|string $name String of variable name or array of variable names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistVar($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistVar(func_get_args());
        }
        return $this->blacklist(KeywordConstants::VARIABLES, $name);
    }

    /** Remove variable from whitelist.
     *
     * You can pass a string of variable name, or pass an array of the variable names to remove from whitelist
     *
     * @param array|string $name String of variable name or array of variable names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistVar($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistVar(func_get_args());
        }
        return $this->dewhitelist(KeywordConstants::VARIABLES, $name);
    }

    /** Remove function from blacklist.
     *
     * You can pass a string of variable name, or pass an array of the variable names to remove from blacklist
     *
     * @param array|string $name String of variable name or array of variable names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistVar($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistVar(func_get_args());
        }
        return $this->deblacklist(KeywordConstants::VARIABLES, $name);
    }

    /** Whitelist global.
     *
     * You can pass a string of global name, or pass an array of the global names to whitelist
     *
     * @param array|string $name String of global name or array of global names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistGlobal($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistGlobal(func_get_args());
        }
        return $this->whitelist(KeywordConstants::GLOBALS, $name);
    }

    /** Blacklist global.
     *
     * You can pass a string of global name, or pass an array of the global names to blacklist
     *
     * @param array|string $name String of global name or array of global names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistGlobal($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistGlobal(func_get_args());
        }
        return $this->blacklist(KeywordConstants::GLOBALS, $name);
    }

    /** Remove global from whitelist.
     *
     * You can pass a string of global name, or pass an array of the global names to remove from whitelist
     *
     * @param array|string $name String of global name or array of global names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistGlobal($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistGlobal(func_get_args());
        }
        return $this->dewhitelist(KeywordConstants::GLOBALS, $name);
    }

    /** Remove global from blacklist.
     *
     * You can pass a string of global name, or pass an array of the global names to remove from blacklist
     *
     * @param array|string $name String of global name or array of global names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistGlobal($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistGlobal(func_get_args());
        }
        return $this->deblacklist(KeywordConstants::GLOBALS, $name);
    }

    /** Whitelist superglobal or superglobal key.
     *
     * You can pass a string of the superglobal name, or a string of the superglobal name and a string of the key,
     * or pass an array of superglobal names, or an associative array of superglobal names and their keys to whitelist
     *
     * @param array|string $name String of superglobal name, or an array of superglobal names, or an associative array of superglobal names and their keys to whitelist
     * @param null|string $key String of superglobal key to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistSuperglobal($name, ?string $key = null): self
    {
        if (is_string($name)) {
            $name = $this->normalizeSuperglobal($name);
        }
        if (is_string($name) && $name && ! isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->whitelist[KeywordConstants::SUPERGLOBALS][$name] = [];
        }
        if (is_array($name)) {
            foreach ($name as $_name => $key) {
                if (is_int($_name)) {
                    if (is_string($key) && $key) {
                        $this->whitelist[KeywordConstants::SUPERGLOBALS][$key] = [];
                    }
                } else {
                    $_name = $this->normalizeSuperglobal($_name);
                    if (is_string($_name) && $_name && ! isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name])) {
                        $this->whitelist[KeywordConstants::SUPERGLOBALS][$_name] = [];
                    }
                    if (is_string($key) && $key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name])) {
                        $this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$key] = true;
                    } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name]) && is_array($key)) {
                        foreach ($key as $_key) {
                            if (is_string($_key) && $_key) {
                                $this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$_name] = true;
                            }
                        }
                    }
                }
            }
        } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]) && is_array($key)) {
            foreach ($key as $_key) {
                if (is_string($_key) && $_key) {
                    $this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$_key] = true;
                }
            }
        } elseif (is_string($key) && $key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$key] = true;
        }
        return $this;
    }

    /** Blacklist superglobal or superglobal key.
     **
     * You can pass a string of the superglobal name, or a string of the superglobal name and a string of the key,
     * or pass an array of superglobal names, or an associative array of superglobal names and their keys to blacklist
     *
     * @param array|string $name String of superglobal name, or an array of superglobal names, or an associative array of superglobal names and their keys to blacklist
     * @param null|string $key String of superglobal key to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistSuperglobal($name, ?string $key = null): self
    {
        if (is_string($name)) {
            $name = $this->normalizeSuperglobal($name);
        }
        if (is_string($name) && $name && ! isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->blacklist[KeywordConstants::SUPERGLOBALS][$name] = [];
        }
        if (is_array($name)) {
            foreach ($name as $_name => $key) {
                if (is_int($_name)) {
                    if (is_string($key) && $key) {
                        $this->blacklist[KeywordConstants::SUPERGLOBALS][$key] = [];
                    }
                } else {
                    $_name = $this->normalizeSuperglobal($_name);
                    if (is_string($_name) && $_name && ! isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name])) {
                        $this->blacklist[KeywordConstants::SUPERGLOBALS][$_name] = [];
                    }
                    if (is_string($key) && $key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name])) {
                        $this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$key] = true;
                    } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name]) && is_array($key)) {
                        foreach ($key as $_key) {
                            if (is_string($_key) && $_key) {
                                $this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$_name] = true;
                            }
                        }
                    }
                }
            }
        } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]) && is_array($key)) {
            foreach ($key as $_key) {
                if (is_string($_key) && $_key) {
                    $this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$_key] = true;
                }
            }
        } elseif (is_string($key) && $key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$key] = true;
        }
        return $this;
    }

    /** Remove superglobal or superglobal key from whitelist.
     **
     * You can pass a string of the superglobal name, or a string of the superglobal name and a string of the key,
     * or pass an array of superglobal names, or an associative array of superglobal names and their keys to remove from whitelist
     *
     * @param array|string $name String of superglobal name, or an array of superglobal names, or an associative array of superglobal names and their keys to remove from whitelist
     * @param null|string $key String of superglobal key to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistSuperglobal($name, ?string $key = null): self
    {
        if (is_string($name)) {
            $name = $this->normalizeSuperglobal($name);
        }
        if (is_array($name)) {
            foreach ($name as $_name => $key) {
                if (is_int($_name)) {
                    if (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$key])) {
                        $this->whitelist[KeywordConstants::SUPERGLOBALS][$key] = [];
                    }
                } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name]) && is_string($key) && $key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$key])) {
                    unset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$key]);
                } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name]) && is_array($key)) {
                    foreach ($key as $_key) {
                        if (is_string($_key) && $_key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$_key])) {
                            unset($this->whitelist[KeywordConstants::SUPERGLOBALS][$_name][$_key]);
                        }
                    }
                }
            }
        } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]) && is_string($key) && $key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$key])) {
            unset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$key]);
        } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]) && is_array($key)) {
            foreach ($key as $_key) {
                if (is_string($_key) && $_key && isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$_key])) {
                    unset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name][$_key]);
                }
            }
        } elseif (isset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name])) {
            unset($this->whitelist[KeywordConstants::SUPERGLOBALS][$name]);
        }
        return $this;
    }

    /** Remove superglobal or superglobal key from blacklist.
     **
     * You can pass a string of the superglobal name, or a string of the superglobal name and a string of the key,
     * or pass an array of superglobal names, or an associative array of superglobal names and their keys to remove from blacklist
     *
     * @param array|string $name String of superglobal name, or an array of superglobal names, or an associative array of superglobal names and their keys to remove from blacklist
     * @param null|string $key String of superglobal key to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistSuperglobal($name, ?string $key = null): self
    {
        if (is_string($name)) {
            $name = $this->normalizeSuperglobal($name);
        }
        if (is_array($name)) {
            foreach ($name as $_name => $key) {
                if (is_int($_name)) {
                    if (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$key])) {
                        $this->blacklist[KeywordConstants::SUPERGLOBALS][$key] = [];
                    }
                } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name]) && is_string($key) && $key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$key])) {
                    unset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$key]);
                } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name]) && is_array($key)) {
                    foreach ($key as $_key) {
                        if (is_string($_key) && $_key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$_key])) {
                            unset($this->blacklist[KeywordConstants::SUPERGLOBALS][$_name][$_key]);
                        }
                    }
                }
            }
        } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]) && is_string($key) && $key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$key])) {
            unset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$key]);
        } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]) && is_array($key)) {
            foreach ($key as $_key) {
                if (is_string($_key) && $_key && isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$_key])) {
                    unset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name][$_key]);
                }
            }
        } elseif (isset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name])) {
            unset($this->blacklist[KeywordConstants::SUPERGLOBALS][$name]);
        }
        return $this;
    }

    /** Whitelist constant.
     *
     * You can pass a string of constant name, or pass an array of the constant names to whitelist
     *
     * @param array|string $name String of constant name or array of constant names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistConst(func_get_args());
        }
        return $this->whitelist(KeywordConstants::CONSTANTS, $name);
    }

    /** Blacklist constant.
     *
     * You can pass a string of constant name, or pass an array of the constant names to blacklist
     *
     * @param array|string $name String of constant name or array of constant names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistConst(func_get_args());
        }
        return $this->blacklist(KeywordConstants::CONSTANTS, $name);
    }

    /** Remove constant from whitelist.
     *
     * You can pass a string of constant name, or pass an array of the constant names to remove from whitelist
     *
     * @param array|string $name String of constant name or array of constant names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistConst(func_get_args());
        }
        return $this->dewhitelist(KeywordConstants::CONSTANTS, $name);
    }

    /** Remove constant from blacklist.
     *
     * You can pass a string of constant name, or pass an array of the constant names to remove from blacklist
     *
     * @param array|string $name String of constant name or array of constant names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistConst(func_get_args());
        }
        return $this->deblacklist(KeywordConstants::CONSTANTS, $name);
    }

    /** Whitelist magic constant.
     *
     * You can pass a string of magic constant name, or pass an array of the magic constant names to whitelist
     *
     * @param array|string $name String of magic constant name or array of magic constant names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistMagicConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistMagicConst(func_get_args());
        }
        $name = $this->normalizeMagicConst($name);
        return $this->whitelist(KeywordConstants::MAGIC_CONSTANTS, $name);
    }

    /** Blacklist magic constant.
     *
     * You can pass a string of magic constant name, or pass an array of the magic constant names to blacklist
     *
     * @param array|string $name String of magic constant name or array of magic constant names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistMagicConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistMagicConst(func_get_args());
        }
        $name = $this->normalizeMagicConst($name);
        return $this->blacklist(KeywordConstants::MAGIC_CONSTANTS, $name);
    }

    /** Remove magic constant from whitelist.
     *
     * You can pass a string of magic constant name, or pass an array of the magic constant names to remove from whitelist
     *
     * @param array|string $name String of magic constant name or array of magic constant names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistMagicConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistMagicConst(func_get_args());
        }
        $name = $this->normalizeMagicConst($name);
        return $this->dewhitelist(KeywordConstants::MAGIC_CONSTANTS, $name);
    }

    /** Remove magic constant from blacklist.
     *
     * You can pass a string of magic constant name, or pass an array of the magic constant names to remove from blacklist
     *
     * @param array|string $name String of magic constant name or array of magic constant names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistMagicConst($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistMagicConst(func_get_args());
        }
        $name = $this->normalizeMagicConst($name);
        return $this->deblacklist(KeywordConstants::MAGIC_CONSTANTS, $name);
    }

    /** Whitelist namespace.
     *
     * You can pass a string of namespace name, or pass an array of the namespace names to whitelist
     *
     * @param array|string $name String of namespace name or array of namespace names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistNamespace($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistNamespace(func_get_args());
        }
        $name = $this->normalizeNamespace($name);
        return $this->whitelist(KeywordConstants::NAMESPACES, $name);
    }

    /** Blacklist namespace.
     *
     * You can pass a string of namespace name, or pass an array of the namespace names to blacklist
     *
     * @param array|string $name String of namespace name or array of namespace names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistNamespace($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistNamespace(func_get_args());
        }
        $name = $this->normalizeNamespace($name);
        return $this->blacklist(KeywordConstants::NAMESPACES, $name);
    }

    /** Remove namespace from whitelist.
     *
     * You can pass a string of namespace name, or pass an array of the namespace names to remove from whitelist
     *
     * @param array|string $name String of namespace name or array of namespace names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistNamespace($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistNamespace(func_get_args());
        }
        $name = $this->normalizeNamespace($name);
        return $this->dewhitelist(KeywordConstants::NAMESPACES, $name);
    }

    /** Remove namespace from blacklist.
     *
     * You can pass a string of namespace name, or pass an array of the namespace names to remove from blacklist
     *
     * @param array|string $name String of namespace name or array of namespace names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistNamespace($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistNamespace(func_get_args());
        }
        $name = $this->normalizeNamespace($name);
        return $this->deblacklist(KeywordConstants::NAMESPACES, $name);
    }

    /** Whitelist alias.
     *
     * You can pass a string of alias name, or pass an array of the alias names to whitelist
     *
     * @param array|string $name String of alias names  or array of alias names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistAlias($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistAlias(func_get_args());
        }
        $name = $this->normalizeAlias($name);
        return $this->whitelist(KeywordConstants::ALIASES, $name);
    }

    /** Blacklist alias.
     *
     * You can pass a string of alias name, or pass an array of the alias names to blacklist
     *
     * @param array|string $name String of alias name or array of alias names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistAlias($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistAlias(func_get_args());
        }
        $name = $this->normalizeAlias($name);
        return $this->blacklist(KeywordConstants::ALIASES, $name);
    }

    /** Remove alias from whitelist.
     *
     * You can pass a string of alias name, or pass an array of the alias names to remove from whitelist
     *
     * @param array|string $name String of alias name or array of alias names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistAlias($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistAlias(func_get_args());
        }
        $name = $this->normalizeAlias($name);
        return $this->dewhitelist(KeywordConstants::ALIASES, $name);
    }

    /** Remove alias from blacklist.
     *
     * You can pass a string of alias name, or pass an array of the alias names to remove from blacklist
     *
     * @param array|string $name String of alias name or array of alias names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistAlias($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistAlias(func_get_args());
        }
        $name = $this->normalizeAlias($name);
        return $this->deblacklist(KeywordConstants::ALIASES, $name);
    }

    /** Whitelist use (or alias).
     *
     * You can pass a string of use (or alias) name, or pass an array of the use (or alias) names to whitelist
     *
     * @alias   whitelistAlias();
     *
     * @param array|string $name String of use (or alias) name or array of use (or alias) names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistUse($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistAlias(func_get_args());
        }
        return $this->whitelistAlias($name);
    }

    /** Blacklist use (or alias).
     *
     * You can pass a string of use (or alias) name, or pass an array of the use (or alias) names to blacklist
     *
     * @alias   blacklistAlias();
     *
     * @param array|string $name String of use (or alias) name or array of use (or alias) names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistUse($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistAlias(func_get_args());
        }
        return $this->blacklistAlias($name);
    }

    /** Remove use (or alias) from whitelist.
     *
     * You can pass a string of use (or alias name, or pass an array of the use (or alias) names to remove from whitelist
     *
     * @alias   dewhitelistAlias();
     *
     * @param array|string $name String of use (or alias) name or array of use (or alias) names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistUse($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistAlias(func_get_args());
        }
        return $this->dewhitelistAlias($name);
    }

    /** Remove use (or alias) from blacklist.
     *
     * You can pass a string of use (or alias name, or pass an array of the use (or alias) names to remove from blacklist
     *
     * @alias   deblacklistAlias();
     *
     * @param array|string $name String of use (or alias) name or array of use (or alias) names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistUse($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistAlias(func_get_args());
        }
        return $this->deblacklistAlias($name);
    }

    /** Whitelist class.
     *
     * You can pass a string of class name, or pass an array of the class names to whitelist
     *
     * @param array|string $name String of class name or array of class names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistClass($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistClass(func_get_args());
        }
        $name = $this->normalizeClass($name);
        return $this->whitelist(KeywordConstants::CLASSES, $name);
    }

    /** Blacklist class.
     *
     * You can pass a string of class name, or pass an array of the class names to blacklist
     *
     * @param array|string $name String of class name or array of class names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistClass($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistClass(func_get_args());
        }
        $name = $this->normalizeClass($name);
        return $this->blacklist(KeywordConstants::CLASSES, $name);
    }

    /** Remove class from whitelist.
     *
     * You can pass a string of class name, or pass an array of the class names to remove from whitelist
     *
     * @param array|string $name String of class name or array of class names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistClass($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistClass(func_get_args());
        }
        $name = $this->normalizeClass($name);
        return $this->dewhitelist(KeywordConstants::CLASSES, $name);
    }

    /** Remove class from blacklist.
     *
     * You can pass a string of class name, or pass an array of the class names to remove from blacklist
     *
     * @param array|string $name String of class name or array of class names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistClass($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistClass(func_get_args());
        }
        $name = $this->normalizeClass($name);
        return $this->deblacklist(KeywordConstants::CLASSES, $name);
    }

    /** Whitelist interface.
     *
     * You can pass a string of interface name, or pass an array of the interface names to whitelist
     *
     * @param array|string $name String of interface name or array of interface names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistInterface($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistInterface(func_get_args());
        }
        $name = $this->normalizeInterface($name);
        return $this->whitelist(KeywordConstants::INTERFACES, $name);
    }

    /** Blacklist interface.
     *
     * You can pass a string of interface name, or pass an array of the interface names to blacklist
     *
     * @param array|string $name String of interface name or array of interface names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistInterface($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistInterface(func_get_args());
        }
        $name = $this->normalizeInterface($name);
        return $this->blacklist(KeywordConstants::INTERFACES, $name);
    }

    /** Remove interface from whitelist.
     *
     * You can pass a string of interface name, or pass an array of the interface names to remove from whitelist
     *
     * @param array|string $name String of interface name or array of interface names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistInterface($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistInterface(func_get_args());
        }
        $name = $this->normalizeInterface($name);
        return $this->dewhitelist(KeywordConstants::INTERFACES, $name);
    }

    /** Remove interface from blacklist.
     *
     * You can pass a string of interface name, or pass an array of the interface names to remove from blacklist
     *
     * @param array|string $name String of interface name or array of interface names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistInterface($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistInterface(func_get_args());
        }
        $name = $this->normalizeInterface($name);
        return $this->deblacklist(KeywordConstants::INTERFACES, $name);
    }

    /** Whitelist trait.
     *
     * You can pass a string of trait name, or pass an array of the trait names to whitelist
     *
     * @param array|string $name String of trait name or array of trait names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistTrait($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistTrait(func_get_args());
        }
        $name = $this->normalizeTrait($name);
        return $this->whitelist(KeywordConstants::TRAITS, $name);
    }

    /** Blacklist trait.
     *
     * You can pass a string of trait name, or pass an array of the trait names to blacklist
     *
     * @param array|string $name String of trait name or array of trait names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistTrait($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistTrait(func_get_args());
        }
        $name = $this->normalizeTrait($name);
        return $this->blacklist(KeywordConstants::TRAITS, $name);
    }

    /** Remove trait from whitelist.
     *
     * You can pass a string of trait name, or pass an array of the trait names to remove from whitelist
     *
     * @param array|string $name String of trait name or array of trait names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistTrait($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistTrait(func_get_args());
        }
        $name = $this->normalizeTrait($name);
        return $this->dewhitelist(KeywordConstants::TRAITS, $name);
    }

    /** Remove trait from blacklist.
     *
     * You can pass a string of trait name, or pass an array of the trait names to remove from blacklist
     *
     * @param array|string $name String of trait name or array of trait names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistTrait($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistTrait(func_get_args());
        }
        $name = $this->normalizeTrait($name);
        return $this->deblacklist(KeywordConstants::TRAITS, $name);
    }

    /** Whitelist keyword.
     *
     * You can pass a string of keyword name, or pass an array of the keyword names to whitelist
     *
     * @param array|string $name String of keyword name or array of keyword names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistKeyword($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistKeyword(func_get_args());
        }
        $name = $this->normalizeKeyword($name);
        return $this->whitelist(KeywordConstants::KEYWORDS, $name);
    }

    /** Blacklist keyword.
     *
     * You can pass a string of keyword name, or pass an array of the keyword names to blacklist
     *
     * @param array|string $name String of keyword name or array of keyword names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistKeyword($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistKeyword(func_get_args());
        }
        $name = $this->normalizeKeyword($name);
        return $this->blacklist(KeywordConstants::KEYWORDS, $name);
    }

    /** Remove keyword from whitelist.
     *
     * You can pass a string of keyword name, or pass an array of the keyword names to remove from whitelist
     *
     * @param array|string $name String of keyword name or array of keyword names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistKeyword($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistKeyword(func_get_args());
        }
        $name = $this->normalizeKeyword($name);
        return $this->dewhitelist(KeywordConstants::KEYWORDS, $name);
    }

    /** Remove keyword from blacklist.
     *
     * You can pass a string of keyword name, or pass an array of the keyword names to remove from blacklist
     *
     * @param array|string $name String of keyword name or array of keyword names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistKeyword($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistKeyword(func_get_args());
        }
        $name = $this->normalizeKeyword($name);
        return $this->deblacklist(KeywordConstants::KEYWORDS, $name);
    }

    /** Whitelist operator.
     *
     * You can pass a string of operator name, or pass an array of the operator names to whitelist
     *
     * @param array|string $name String of operator name or array of operator names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistOperator($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistOperator(func_get_args());
        }
        $name = $this->normalizeOperator($name);
        return $this->whitelist(KeywordConstants::OPERATORS, $name);
    }

    /** Blacklist operator.
     *
     * You can pass a string of operator name, or pass an array of the operator names to blacklist
     *
     * @param array|string $name String of operator name or array of operator names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistOperator($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistOperator(func_get_args());
        }
        $name = $this->normalizeOperator($name);
        return $this->blacklist(KeywordConstants::OPERATORS, $name);
    }

    /** Remove operator from whitelist.
     *
     * You can pass a string of operator name, or pass an array of the operator names to remove from whitelist
     *
     * @param array|string $name String of operator name or array of operator names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistOperator($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistOperator(func_get_args());
        }
        $name = $this->normalizeOperator($name);
        return $this->dewhitelist(KeywordConstants::OPERATORS, $name);
    }

    /** Remove operator from blacklist.
     *
     * You can pass a string of operator name, or pass an array of the operator names to remove from blacklist
     *
     * @param array|string $name String of operator name or array of operator names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistOperator($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistOperator(func_get_args());
        }
        $name = $this->normalizeOperator($name);
        return $this->deblacklist(KeywordConstants::OPERATORS, $name);
    }

    /** Whitelist primitive.
     *
     * You can pass a string of primitive name, or pass an array of the primitive names to whitelist
     *
     * @param array|string $name String of primitive name or array of primitive names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistPrimitive($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistPrimitive(func_get_args());
        }
        $name = $this->normalizePrimitive($name);
        return $this->whitelist(KeywordConstants::PRIMITIVES, $name);
    }

    /** Blacklist primitive.
     *
     * You can pass a string of primitive name, or pass an array of the primitive names to blacklist
     *
     * @param array|string $name String of primitive name or array of primitive names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistPrimitive($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistPrimitive(func_get_args());
        }
        $name = $this->normalizePrimitive($name);
        return $this->blacklist(KeywordConstants::PRIMITIVES, $name);
    }

    /** Remove primitive from whitelist.
     *
     * You can pass a string of primitive name, or pass an array of the primitive names to remove from whitelist
     *
     * @param array|string $name String of primitive name or array of primitive names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistPrimitive($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistPrimitive(func_get_args());
        }
        $name = $this->normalizePrimitive($name);
        return $this->dewhitelist(KeywordConstants::PRIMITIVES, $name);
    }

    /** Remove primitive from blacklist.
     *
     * You can pass a string of primitive name, or pass an array of the primitive names to remove from blacklist
     *
     * @param array|string $name String of primitive name or array of primitive names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistPrimitive($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistPrimitive(func_get_args());
        }
        $name = $this->normalizePrimitive($name);
        return $this->deblacklist(KeywordConstants::PRIMITIVES, $name);
    }

    /** Whitelist type.
     *
     * You can pass a string of type name, or pass an array of the type names to whitelist
     *
     * @param array|string $name String of type name or array of type names to whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function whitelistType($name): self
    {
        if (func_num_args() > 1) {
            return $this->whitelistType(func_get_args());
        }
        $name = $this->normalizeType($name);
        return $this->whitelist(KeywordConstants::TYPES, $name);
    }

    /** Blacklist type.
     *
     * You can pass a string of type name, or pass an array of the type names to blacklist
     *
     * @param array|string $name String of type name or array of type names to blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function blacklistType($name): self
    {
        if (func_num_args() > 1) {
            return $this->blacklistType(func_get_args());
        }
        $name = $this->normalizeType($name);
        return $this->blacklist(KeywordConstants::TYPES, $name);
    }

    /** Remove type from whitelist.
     *
     * You can pass a string of type name, or pass an array of the type names to remove from whitelist
     *
     * @param array|string $name String of type name or array of type names to remove from whitelist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function dewhitelistType($name): self
    {
        if (func_num_args() > 1) {
            return $this->dewhitelistType(func_get_args());
        }
        $name = $this->normalizeType($name);
        return $this->dewhitelist(KeywordConstants::TYPES, $name);
    }

    /** Remove type from blacklist.
     *
     * You can pass a string of type name, or pass an array of the type names to remove from blacklist
     *
     * @param array|string $name String of type name or array of type names to remove from blacklist
     *
     * @return AccessControl Returns the PHPSandbox instance for fluent querying
     */
    public function deblacklistType($name): self
    {
        if (func_num_args() > 1) {
            return $this->deblacklistType(func_get_args());
        }
        $name = $this->normalizeType($name);
        return $this->deblacklist(KeywordConstants::TYPES, $name);
    }
}
