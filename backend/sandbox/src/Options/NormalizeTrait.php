<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

trait NormalizeTrait
{
    /** Normalize trait name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the trait $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized trait string or an array of normalized strings
     */
    protected function normalizeTrait($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeTrait($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize interface name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the interface $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized interface string or an array of normalized strings
     */
    protected function normalizeInterface($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeInterface($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize class name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the class $name to normalize
     *
     * @return array|string Returns the normalized class string or an array of normalized strings
     */
    protected function normalizeClass($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeClass($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize magic constant name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the magic constant $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized magic constant string or an array of normalized strings
     */
    protected function normalizeMagicConst($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeMagicConst($value);
            }
            return $name;
        }
        return strtoupper(trim($name, '_'));
    }

    /** Normalize superglobal name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the superglobal $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized superglobal string or an array of normalized strings
     */
    protected function normalizeSuperglobal($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeSuperglobal($value);
            }
            return $name;
        }
        return strtoupper(ltrim($name, '_'));
    }

    /** Normalize alias name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the alias $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized alias string or an array of normalized strings
     */
    protected function normalizeAlias($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeAlias($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize namespace name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the namespace $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized namespace string or an array of normalized strings
     */
    protected function normalizeNamespace($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeNamespace($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize function name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the function $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized function string or an array of normalized strings
     */
    protected function normalizeFunc($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeFunc($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize keyword name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the keyword $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized keyword string or an array of normalized strings
     */
    protected function normalizeKeyword($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeKeyword($value);
            }
            return $name;
        }
        $name = strtolower($name);
        switch ($name) {
            case 'die':
                return 'exit';
            case 'include_once':
            case 'require':
            case 'require_once':
                return 'include';
            case 'label':   // not a real keyword, only for defining purposes, can't use labels without goto
                return 'goto';
            case 'print':   // for our purposes print is treated as functionally equivalent to echo
                return 'echo';
            case 'else':    // no point in using ifs without else
            case 'elseif':  // no point in using ifs without elseif
                return 'if';
            case 'case':
                return 'switch';
            case 'catch':    // no point in using catch without try
            case 'finally':  // no point in using try, catch or finally without try
                return 'try';
            case 'do':       // no point in using do without while
                return 'while';
            case 'foreach':  // no point in using foreach without for
                return 'for';
            case '__halt_compiler':
                return 'halt';
            case 'alias':   // for consistency with alias and use descriptions
                return 'use';
        }
        return $name;
    }

    /** Normalize operator name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the operator $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized operator string or an array of normalized strings
     */
    protected function normalizeOperator($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeOperator($value);
            }
            return $name;
        }
        $name = strtolower($name);
        if (strpos($name, '++') !== false) {
            $name = (strpos($name, '++') === 0) ? '++n' : 'n++';
        } elseif (strpos($name, '--') !== false) {
            $name = (strpos($name, '--') === 0) ? '--n' : 'n--';
        } elseif (strpos($name, '+') !== false && strlen($name) > 1) {
            $name = '+n';
        } elseif (strpos($name, '-') !== false && strlen($name) > 1) {
            $name = '-n';
        }
        return $name;
    }

    /** Normalize primitive name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the primitive $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized primitive string or an array of normalized strings
     */
    protected function normalizePrimitive($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizePrimitive($value);
            }
            return $name;
        }
        $name = strtolower($name);
        if ($name == 'double') {
            $name = 'float';
        } elseif ($name == 'integer') {
            $name = 'int';
        }
        return $name;
    }

    /** Normalize type name.  This is an internal PHPSandbox function.
     *
     * @param array|string $name String of the type $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized type string or an array of normalized strings
     */
    protected function normalizeType($name)
    {
        if (is_array($name)) {
            foreach ($name as &$value) {
                $value = $this->normalizeType($value);
            }
            return $name;
        }
        return strtolower($name);
    }

    /** Normalize use (or alias) name.  This is an internal PHPSandbox function.
     *
     * @alias   normalizeAlias();
     *
     * @param array|string $name String of the use (or alias) $name, or array of strings to normalize
     *
     * @return array|string Returns the normalized use (or alias) string or an array of normalized strings
     */
    protected function normalizeUse($name)
    {
        return $this->normalizeAlias($name);
    }
}
