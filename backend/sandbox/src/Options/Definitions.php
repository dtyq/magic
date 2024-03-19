<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

use PHPSandbox\Constants\KeywordConstants;
use PHPSandbox\Error;
use PHPSandbox\PHPSandbox;
use Throwable;

class Definitions
{
    use NormalizeTrait;

    /**
     * @var null|ValidationError ValidationError Configuration
     */
    protected ?ValidationError $error = null;

    /**
     * @var array Array of defined functions, superglobals, etc. If an array type contains elements, then it overwrites its external counterpart
     */
    protected array $definitions = [
        KeywordConstants::FUNCTION => [],
        KeywordConstants::VARIABLES => [],
        KeywordConstants::SUPERGLOBALS => [],
        KeywordConstants::CONSTANTS => [],
        KeywordConstants::MAGIC_CONSTANTS => [],
        KeywordConstants::NAMESPACES => [],
        KeywordConstants::ALIASES => [],
        KeywordConstants::CLASSES => [],
        KeywordConstants::INTERFACES => [],
        KeywordConstants::TRAITS => [],
    ];

    public function getValidationError(): ?ValidationError
    {
        return $this->error;
    }

    public function setValidationError(?ValidationError $error): self
    {
        $this->error = $error;
        return $this;
    }

    /** Define PHPSandbox definitions, such as functions, constants, namespaces, etc.
     *
     * You can pass a string of the $type, $name and $value, or pass an associative array of definitions types and
     * an associative array of their corresponding values
     *
     * @param array|string $type Associative array or string of definition type to define
     * @param null|array|string $name Associative array or string of definition name to define
     * @param null|mixed $value Value of definition to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if definition fails
     */
    public function define($type, $name = null, $value = null): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (is_string($_type) && $_type && is_array($name)) {
                    foreach ($name as $_name => $_value) {
                        $this->define($_type, is_int($_name) ? $_value : $_name, is_int($_name) ? $value : $_value);
                    }
                }
            }
        } elseif ($type && is_array($name)) {
            foreach ($name as $_name => $_value) {
                $this->define($type, is_int($_name) ? $_value : $_name, is_int($_name) ? $value : $_value);
            }
        } elseif ($type && $name) {
            switch ($type) {
                case KeywordConstants::FUNCTION:
                    return $this->defineFunc($name, $value);
                case KeywordConstants::VARIABLES:
                    return $this->defineVar($name, $value);
                case KeywordConstants::SUPERGLOBALS:
                    return $this->defineSuperglobal($name, $value);
                case KeywordConstants::CONSTANTS:
                    return $this->defineConst($name, $value);
                case KeywordConstants::MAGIC_CONSTANTS:
                    return $this->defineMagicConst($name, $value);
                case KeywordConstants::NAMESPACES:
                    return $this->defineNamespace($name);
                case KeywordConstants::ALIASES:
                    return $this->defineAlias($name, $value);
                case KeywordConstants::CLASSES:
                    return $this->defineClass($name, $value);
                case KeywordConstants::INTERFACES:
                    return $this->defineInterface($name, $value);
                case KeywordConstants::TRAITS:
                    return $this->defineTrait($name, $value);
            }
        }
        return $this;
    }

    /** Undefine PHPSandbox definitions, such as functions, constants, namespaces, etc.
     *
     * You can pass a string of the $type and $name to undefine, or pass an associative array of definitions types
     * and an array of key names to undefine
     *
     * @param array|string $type Associative array or string of definition type to undefine
     * @param array|string $name Associative array or string of definition name to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefine($type, $name = null): self
    {
        if (is_array($type)) {
            foreach ($type as $_type => $name) {
                if (is_string($_type) && $_type && is_array($name)) {
                    foreach ($name as $_name) {
                        if (is_string($_name) && $_name) {
                            $this->undefine($type, $name);
                        }
                    }
                }
            }
        } elseif (is_string($type) && $type && is_array($name)) {
            foreach ($name as $_name) {
                if (is_string($_name) && $_name) {
                    $this->undefine($type, $name);
                }
            }
        } elseif ($type && $name) {
            switch ($type) {
                case 'functions':
                    return $this->undefineFunc($name);
                case KeywordConstants::VARIABLES:
                    return $this->undefineVar($name);
                case KeywordConstants::SUPERGLOBALS:
                    return $this->undefineSuperglobal($name);
                case KeywordConstants::CONSTANTS:
                    return $this->undefineConst($name);
                case KeywordConstants::MAGIC_CONSTANTS:
                    return $this->undefineMagicConst($name);
                case KeywordConstants::NAMESPACES:
                    return $this->undefineNamespace($name);
                case KeywordConstants::ALIASES:
                    return $this->undefineAlias($name);
                case KeywordConstants::CLASSES:
                    return $this->undefineClass($name);
                case KeywordConstants::INTERFACES:
                    return $this->undefineInterface($name);
                case KeywordConstants::TRAITS:
                    return $this->undefineTrait($name);
            }
        }
        return $this;
    }

    /** Define PHPSandbox function.
     *
     * You can pass the function $name and $function closure or callable to define, or an associative array of
     * functions to define, which can have callable values or arrays of the function callable and $pass_sandbox flag
     *
     * @param array|string $name Associative array or string of function $name to define
     * @param callable $function Callable to define $function to
     * @param bool $pass_sandbox Pass PHPSandbox instance to defined function when called? Default is false
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed or uncallable $function is defined
     */
    public function defineFunc($name, callable $function, bool $pass_sandbox = false): self
    {
        if (is_array($name)) {
            return $this->defineFuncs($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed function!', Error::DEFINE_FUNC_ERROR, null, '');
        }
        if (is_array($function) && count($function)) {    // so you can pass array of function names and array of function and pass_sandbox flag
            $pass_sandbox = $function[1] ?? false;
            $function = $function[0];
        }
        $original_name = $name;
        $name = $this->normalizeFunc($name);
        if (! is_callable($function)) {
            $this->error->validationError("Cannot define uncallable function : {$original_name}", Error::DEFINE_FUNC_ERROR, null, $original_name);
        }
        $this->definitions[KeywordConstants::FUNCTION][$name] = [
            'function' => $function,
            'pass_sandbox' => $pass_sandbox,
        ];
        return $this;
    }

    /** Define PHPSandbox functions by array.
     *
     * You can pass an associative array of functions to define
     *
     * @param array $functions Associative array of $functions to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed or uncallable $function is defined
     */
    public function defineFuncs(array $functions = []): self
    {
        foreach ($functions as $name => $function) {
            $this->defineFunc($name, $function);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined functions.
     *
     * @return int Returns the number of functions this instance has defined
     */
    public function hasDefinedFuncs(): int
    {
        return count($this->definitions[KeywordConstants::FUNCTION]);
    }

    /** Check if PHPSandbox instance has $name function defined.
     *
     * @param string $name String of function $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined function, false otherwise
     */
    public function isDefinedFunc($name): bool
    {
        $name = $this->normalizeFunc($name);
        return isset($this->definitions[KeywordConstants::FUNCTION][$name]);
    }

    /** Get defined class of $name.
     *
     * @param string $name String of class $name to get
     *
     * @return mixed Returns string of defined class value
     * @throws Throwable Throws an exception if an invalid class name is requested
     */
    public function getDefinedFunc(?string $name = null, ?string $key = null): mixed
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::FUNCTION];
        }
        $name = $this->normalizeFunc($name);
        if (! $key) {
            if (! isset($this->definitions[KeywordConstants::FUNCTION][$name])) {
                $this->error->validationError("Could not get undefined function: {$name}", Error::VALID_CLASS_ERROR, null, $name);
            }
            return $this->definitions[KeywordConstants::FUNCTION][$name];
        }
        if (! isset($this->definitions[KeywordConstants::FUNCTION][$name][$key])) {
            $this->error->validationError("Could not get undefined function: {$name}" . '-' . " {$key}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::FUNCTION][$name][$key];
    }

    /** Undefine PHPSandbox function.
     *
     * You can pass a string of function $name to undefine, or pass an array of function names to undefine
     *
     * @param array|string $name String of function name or array of function names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineFunc($name): self
    {
        if (is_array($name)) {
            return $this->undefineFuncs($name);
        }
        $name = $this->normalizeFunc($name);
        if (isset($this->definitions[KeywordConstants::FUNCTION][$name])) {
            unset($this->definitions[KeywordConstants::FUNCTION][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox functions by array.
     *
     * You can pass an array of function names to undefine, or an empty array or null argument to undefine all functions
     *
     * @param array $functions Array of function names to undefine. Passing an empty array or no argument will result in undefining all functions
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineFuncs(array $functions = []): self
    {
        if (count($functions)) {
            foreach ($functions as $function) {
                $this->undefineFunc($function);
            }
        } else {
            $this->definitions[KeywordConstants::FUNCTION] = [];
        }
        return $this;
    }

    /** Define PHPSandbox variable.
     *
     * You can pass the variable $name and $value to define, or an associative array of variables to define
     *
     * @param array|string $name String of variable $name or associative array to define
     * @param mixed $value Value to define variable to
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed variable is defined
     */
    public function defineVar($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineVars($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed variable!', Error::DEFINE_VAR_ERROR, null, '');
        }
        if (in_array($name, PHPSandbox::$inner_variable)) {
            $this->error->validationError('Cannot define sandbox inner variable!', Error::DEFINE_VAR_ERROR, null, '');
        }
        $this->definitions[KeywordConstants::VARIABLES][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox variables by array.
     *
     * You can pass an associative array of variables to define
     *
     * @param array $variables Associative array of $variables to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed variable is defined
     */
    public function defineVars(array $variables = []): self
    {
        foreach ($variables as $name => $value) {
            $this->defineVar($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined variables.
     *
     * @return int Returns the number of variables this instance has defined
     */
    public function hasDefinedVars(): int
    {
        return count($this->definitions[KeywordConstants::VARIABLES]);
    }

    /** Check if PHPSandbox instance has $name variable defined.
     *
     * @param string $name String of variable $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined variable, false otherwise
     */
    public function isDefinedVar($name): bool
    {
        return isset($this->definitions[KeywordConstants::VARIABLES][$name]);
    }

    /** Undefine PHPSandbox variable.
     *
     * You can pass a string of variable $name to undefine, or an array of variable names to undefine
     *
     * @param array|string $name String of variable name or an array of variable names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineVar($name): self
    {
        if (is_array($name)) {
            return $this->undefineVars($name);
        }
        if (isset($this->definitions[KeywordConstants::VARIABLES][$name])) {
            unset($this->definitions[KeywordConstants::VARIABLES][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox variables by array.
     *
     * You can pass an array of variable names to undefine, or an empty array or null argument to undefine all variables
     *
     * @param array $variables Array of variable names to undefine. Passing an empty array or no argument will result in undefining all variables
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineVars(array $variables = []): self
    {
        if (count($variables)) {
            foreach ($variables as $variable) {
                $this->undefineVar($variable);
            }
        } else {
            $this->definitions[KeywordConstants::VARIABLES] = [];
        }
        return $this;
    }

    /**
     * @param null|mixed $name
     * @throws Throwable
     */
    public function getDefinedVars($name = null): mixed
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::VARIABLES];
        }
        if (! isset($this->definitions[KeywordConstants::VARIABLES][$name])) {
            $this->error->validationError("Could not get undefined variables: {$name}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::VARIABLES][$name];
    }

    /** Define PHPSandbox superglobal.
     *
     * You can pass the superglobal $name and $value to define, or an associative array of superglobals to define, or a third variable to define the $key
     *
     * @param array|string $name String of superglobal $name or associative array of superglobal names to define
     * @param mixed $value Value to define superglobal to, can be callable
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed superglobal is defined
     */
    public function defineSuperglobal($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineSuperglobals($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed superglobal!', Error::DEFINE_SUPERGLOBAL_ERROR, null, '');
        }
        $name = $this->normalizeSuperglobal($name);
        if (func_num_args() > 2) {
            $key = $value;
            $value = func_get_arg(2);
            $this->definitions[KeywordConstants::SUPERGLOBALS][$name][$key] = $value;
        } else {
            $this->definitions[KeywordConstants::SUPERGLOBALS][$name] = $value;
        }
        return $this;
    }

    /** Define PHPSandbox superglobals by array.
     *
     * You can pass an associative array of superglobals to define
     *
     * @param array $superglobals Associative array of $superglobals to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineSuperglobals(array $superglobals = []): self
    {
        foreach ($superglobals as $name => $value) {
            $this->defineSuperglobal($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined superglobals, or if superglobal $name has defined keys.
     *
     * @param null|string $name String of superglobal $name to check for keys
     *
     * @return int Returns the number of superglobals or superglobal keys this instance has defined, or false if invalid superglobal name specified
     */
    public function hasDefinedSuperglobals(?string $name = null): int
    {
        $name = $name ? $this->normalizeSuperglobal($name) : null;
        return $name ? (isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name]) ? count($this->definitions[KeywordConstants::SUPERGLOBALS][$name]) : 0) : count($this->definitions[KeywordConstants::SUPERGLOBALS]);
    }

    /** Check if PHPSandbox instance has $name superglobal defined, or if superglobal $name key is defined.
     *
     * @param string $name String of superglobal $name to query
     * @param null|string $key String of key to to query in superglobal
     *
     * @return bool Returns true if PHPSandbox instance has defined superglobal, false otherwise
     */
    public function isDefinedSuperglobal(string $name, ?string $key = null): bool
    {
        $name = $this->normalizeSuperglobal($name);
        return $key !== null ? isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name][$key]) : isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name]);
    }

    /** Undefine PHPSandbox superglobal or superglobal key.
     *
     * You can pass a string of superglobal $name to undefine, or a superglobal $key to undefine, or an array of
     * superglobal names to undefine, or an an associative array of superglobal names and keys to undefine
     *
     * @param array|string $name String of superglobal $name, or array of superglobal names, or associative array of superglobal names and keys to undefine
     * @param null|string $key String of superglobal $key to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineSuperglobal($name, $key = null): self
    {
        if (is_array($name)) {
            return $this->undefineSuperglobals($name);
        }
        $name = $this->normalizeSuperglobal($name);
        if ($key !== null && is_array($this->definitions[KeywordConstants::SUPERGLOBALS][$name])) {
            if (isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name][$key])) {
                unset($this->definitions[KeywordConstants::SUPERGLOBALS][$name][$key]);
            }
        } elseif (isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->definitions[KeywordConstants::SUPERGLOBALS][$name] = [];
        }
        return $this;
    }

    /** Undefine PHPSandbox superglobals by array.
     *
     * You can pass an array of superglobal names to undefine, or an associative array of superglobals names and key
     * to undefine, or an empty array or null to undefine all superglobals
     *
     * @param array $superglobals Associative array of superglobal names and keys or array of superglobal names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineSuperglobals(array $superglobals = []): self
    {
        if (count($superglobals)) {
            foreach ($superglobals as $superglobal => $name) {
                $name = $this->normalizeSuperglobal($name);
                $this->undefineSuperglobal(is_int($superglobal) ? $name : $superglobal, is_int($superglobal) || ! is_string($name) ? null : $name);
            }
        } else {
            $this->definitions[KeywordConstants::SUPERGLOBALS] = [];
        }
        return $this;
    }

    public function getDefinedSuperglobals($name = null): mixed
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::SUPERGLOBALS];
        }
        if (! isset($this->definitions[KeywordConstants::SUPERGLOBALS][$name])) {
            $this->error->validationError("Could not get undefined superglobals: {$name}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::SUPERGLOBALS][$name];
    }

    /** Define PHPSandbox constant.
     *
     * You can pass the constant $name and $value to define, or an associative array of constants to define
     *
     * @param array|string $name String of constant $name or associative array to define
     * @param mixed $value Value to define constant to
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed constant is defined
     */
    public function defineConst($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineConsts($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed constant!', Error::DEFINE_CONST_ERROR, null, '');
        }
        $this->definitions[KeywordConstants::CONSTANTS][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox constants by array.
     *
     * You can pass an associative array of constants to define
     *
     * @param array $constants Associative array of $constants to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineConsts(array $constants = []): self
    {
        foreach ($constants as $name => $value) {
            $this->defineConst($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined constants.
     *
     * @return int Returns the number of constants this instance has defined
     */
    public function hasDefinedConsts(): int
    {
        return count($this->definitions[KeywordConstants::CONSTANTS]);
    }

    /** Check if PHPSandbox instance has $name constant defined.
     *
     * @param string $name String of constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined constant, false otherwise
     */
    public function isDefinedConst($name): bool
    {
        return isset($this->definitions[KeywordConstants::CONSTANTS][$name]);
    }

    /** Undefine PHPSandbox constant.
     *
     * You can pass a string of constant $name to undefine, or an array of constant names to undefine
     *
     * @param array|string $name String of constant name or array of constant names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineConst($name): self
    {
        if (is_array($name)) {
            return $this->undefineConsts($name);
        }
        if (isset($this->definitions[KeywordConstants::CONSTANTS][$name])) {
            unset($this->definitions[KeywordConstants::CONSTANTS][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox constants by array.
     *
     * You can pass an array of constant names to undefine, or an empty array or null argument to undefine all constants
     *
     * @param array $constants Array of constant names to undefine. Passing an empty array or no argument will result in undefining all constants
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineConsts(array $constants = []): self
    {
        if (count($constants)) {
            foreach ($constants as $constant) {
                $this->undefineConst($constant);
            }
        } else {
            $this->definitions[KeywordConstants::CONSTANTS] = [];
        }
        return $this;
    }

    public function getDefinedConsts($name = null): mixed
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::CONSTANTS];
        }
        if (! isset($this->definitions[KeywordConstants::CONSTANTS][$name])) {
            $this->error->validationError("Could not get undefined constants: {$name}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::CONSTANTS][$name];
    }

    /** Define PHPSandbox magic constant.
     *
     * You can pass the magic constant $name and $value to define, or an associative array of magic constants to define
     *
     * @param array|string $name String of magic constant $name or associative array to define
     * @param mixed $value Value to define magic constant to, can be callable
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed magic constant is defined
     */
    public function defineMagicConst($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineMagicConsts($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed magic constant!', Error::DEFINE_MAGIC_CONST_ERROR, null, '');
        }
        $name = $this->normalizeMagicConst($name);
        $this->definitions[KeywordConstants::MAGIC_CONSTANTS][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox magic constants by array.
     *
     * You can pass an associative array of magic constants to define
     *
     * @param array $magic_constants Associative array of $magic_constants to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineMagicConsts(array $magic_constants = []): self
    {
        foreach ($magic_constants as $name => $value) {
            $this->defineMagicConst($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined magic constants.
     *
     * @return int Returns the number of magic constants this instance has defined
     */
    public function hasDefinedMagicConsts(): int
    {
        return count($this->definitions[KeywordConstants::MAGIC_CONSTANTS]);
    }

    /** Check if PHPSandbox instance has $name magic constant defined.
     *
     * @param string $name String of magic constant $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined magic constant, false otherwise
     */
    public function isDefinedMagicConst($name): bool
    {
        $name = $this->normalizeMagicConst($name);
        return isset($this->definitions[KeywordConstants::MAGIC_CONSTANTS][$name]);
    }

    /** Undefine PHPSandbox magic constant.
     *
     * You can pass an a string of magic constant $name to undefine, or array of magic constant names to undefine
     *
     * @param array|string $name String of magic constant name, or array of magic constant names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineMagicConst($name): self
    {
        if (is_array($name)) {
            return $this->undefineMagicConsts($name);
        }
        $name = $this->normalizeMagicConst($name);
        if (isset($this->definitions[KeywordConstants::MAGIC_CONSTANTS][$name])) {
            unset($this->definitions[KeywordConstants::MAGIC_CONSTANTS][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox magic constants by array.
     *
     * You can pass an array of magic constant names to undefine, or an empty array or null argument to undefine all magic constants
     *
     * @param array $magic_constants Array of magic constant names to undefine. Passing an empty array or no argument will result in undefining all magic constants
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineMagicConsts(array $magic_constants = []): self
    {
        if (count($magic_constants)) {
            foreach ($magic_constants as $magic_constant) {
                $this->undefineMagicConst($magic_constant);
            }
        } else {
            $this->definitions[KeywordConstants::MAGIC_CONSTANTS] = [];
        }
        return $this;
    }

    public function getDefinedMagicConst(string $name): mixed
    {
        $name = $this->normalizeMagicConst($name);
        return $this->definitions[KeywordConstants::MAGIC_CONSTANTS][$name];
    }

    /** Define PHPSandbox namespace.
     *
     * You can pass the namespace $name and $value to define, or an array of namespaces to define
     *
     * @param array|string $name String of namespace $name, or an array of namespace names to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed namespace is defined
     */
    public function defineNamespace($name): self
    {
        if (is_array($name)) {
            return $this->defineNamespaces($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed namespace!', Error::DEFINE_NAMESPACE_ERROR, null, '');
        }
        $normalized_name = $this->normalizeNamespace($name);
        $this->definitions[KeywordConstants::NAMESPACES][$normalized_name] = $name;
        return $this;
    }

    /** Define PHPSandbox namespaces by array.
     *
     * You can pass an array of namespaces to define
     *
     * @param array $namespaces Array of $namespaces to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineNamespaces(array $namespaces = []): self
    {
        foreach ($namespaces as $name) {
            $this->defineNamespace($name);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined namespaces.
     *
     * @return int Returns the number of namespaces this instance has defined
     */
    public function hasDefinedNamespaces(): int
    {
        return count($this->definitions[KeywordConstants::NAMESPACES]);
    }

    /** Check if PHPSandbox instance has $name namespace defined.
     *
     * @param string $name String of namespace $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined namespace, false otherwise
     */
    public function isDefinedNamespace($name): bool
    {
        $name = $this->normalizeNamespace($name);
        return isset($this->definitions[KeywordConstants::NAMESPACES][$name]);
    }

    /** Get defined namespace of $name.
     *
     * @param null|string $name String of namespace $name to get
     *
     * @return array|string Returns string of defined namespace value
     * @throws Throwable Throws an exception if an invalid namespace name is requested
     */
    public function getDefinedNamespace($name = null): array|string
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::NAMESPACES];
        }
        $name = $this->normalizeNamespace($name);
        if (! isset($this->definitions[KeywordConstants::NAMESPACES][$name])) {
            $this->error->validationError("Could not get undefined namespace: {$name}", Error::VALID_NAMESPACE_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::NAMESPACES][$name];
    }

    /** Undefine PHPSandbox namespace.
     *
     * You can pass a string of namespace $name to undefine, or an array of namespace names to undefine
     *
     * @param array|string $name String of namespace $name, or an array of namespace names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineNamespace($name): self
    {
        if (is_array($name)) {
            return $this->undefineNamespaces($name);
        }
        $name = $this->normalizeNamespace($name);
        if (isset($this->definitions[KeywordConstants::NAMESPACES][$name])) {
            unset($this->definitions[KeywordConstants::NAMESPACES][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox namespaces by array.
     *
     * You can pass an array of namespace names to undefine, or an empty array or null argument to undefine all namespaces
     *
     * @param array $namespaces Array of namespace names to undefine. Passing an empty array or no argument will result in undefining all namespaces
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineNamespaces(array $namespaces = []): self
    {
        if (count($namespaces)) {
            foreach ($namespaces as $namespace) {
                $this->undefineNamespace($namespace);
            }
        } else {
            $this->definitions[KeywordConstants::NAMESPACES] = [];
        }
        return $this;
    }

    /** Define PHPSandbox alias.
     *
     * You can pass the namespace $name and $alias to use, an array of namespaces to use, or an associative array of namespaces to use and their aliases
     *
     * @param array|string $name String of namespace $name to use, or an array of namespaces to use, or an associative array of namespaces and their aliases to use
     * @param null|string $alias String of $alias to use
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed namespace is used
     */
    public function defineAlias($name, $alias = null): self
    {
        if (is_array($name)) {
            return $this->defineAliases($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed namespace alias!', Error::DEFINE_ALIAS_ERROR, null, '');
        }
        $original_name = $name;
        $name = $this->normalizeAlias($name);
        $this->definitions[KeywordConstants::ALIASES][$name] = ['original' => $original_name, 'alias' => $alias];
        return $this;
    }

    /** Define PHPSandbox aliases by array.
     *
     * You can pass an array of namespaces to use, or an associative array of namespaces to use and their aliases
     *
     * @param array $aliases Array of namespaces to use, or an associative array of namespaces and their aliases to use
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed namespace is used
     */
    public function defineAliases(array $aliases = []): self
    {
        foreach ($aliases as $name => $alias) {
            $this->defineAlias($name, $alias);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined aliases.
     *
     * @return int Returns the number of aliases this instance has defined
     */
    public function hasDefinedAliases(): int
    {
        return count($this->definitions[KeywordConstants::ALIASES]);
    }

    /** Check if PHPSandbox instance has $name alias defined.
     *
     * @param string $name String of alias $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined aliases, false otherwise
     */
    public function isDefinedAlias($name): bool
    {
        $name = $this->normalizeAlias($name);
        return isset($this->definitions[KeywordConstants::ALIASES][$name]);
    }

    /** Undefine PHPSandbox alias.
     *
     * You can pass a string of alias $name to undefine, or an array of alias names to undefine
     *
     * @param array|string $name String of alias name, or array of alias names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineAlias($name): self
    {
        if (is_array($name)) {
            return $this->undefineAliases($name);
        }
        $name = $this->normalizeAlias($name);
        if (isset($this->definitions[KeywordConstants::ALIASES][$name])) {
            unset($this->definitions[KeywordConstants::ALIASES][$name]);
        }
        return $this;
    }

    public function getDefinedAlias($name = null): mixed
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::ALIASES];
        }
        $name = $this->normalizeAlias($name);
        if (! isset($this->definitions[KeywordConstants::ALIASES][$name])) {
            $this->error->validationError("Could not get undefined aliases: {$name}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::ALIASES][$name];
    }

    /** Undefine PHPSandbox aliases by array.
     *
     * You can pass an array of alias names to undefine, or an empty array or null argument to undefine all aliases
     *
     * @param array $aliases Array of alias names to undefine. Passing an empty array or no argument will result in undefining all aliases
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineAliases(array $aliases = []): self
    {
        if (count($aliases)) {
            foreach ($aliases as $alias) {
                $this->undefineAlias($alias);
            }
        } else {
            $this->definitions[KeywordConstants::ALIASES] = [];
        }
        return $this;
    }

    /** Define PHPSandbox use (or alias).
     *
     * @alias   defineAlias();
     *
     * You can pass the namespace $name and $alias to use, an array of namespaces to use, or an associative array of namespaces to use and their aliases
     *
     * @param array|string $name String of namespace $name to use, or  or an array of namespaces to use, or an associative array of namespaces and their aliases to use
     * @param null|string $alias String of $alias to use
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed namespace is used
     */
    public function defineUse($name, $alias = null): self
    {
        return $this->defineAlias($name, $alias);
    }

    /** Define PHPSandbox uses (or aliases) by array.
     *
     * @alias   defineAliases();
     *
     * You can pass an array of namespaces to use, or an associative array of namespaces to use and their aliases
     *
     * @param array $uses Array of namespaces to use, or an associative array of namespaces and their aliases to use
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed namespace is used
     */
    public function defineUses(array $uses = []): self
    {
        return $this->defineAliases($uses);
    }

    /** Query whether PHPSandbox instance has defined uses (or aliases).
     *
     * @alias   hasDefinedAliases();
     *
     * @return int Returns the number of uses (or aliases) this instance has defined
     */
    public function hasDefinedUses(): int
    {
        return $this->hasDefinedAliases();
    }

    /** Check if PHPSandbox instance has $name uses (or alias) defined.
     *
     * @alias   isDefinedAlias();
     *
     * @param string $name String of use (or alias) $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined uses (or aliases) and false otherwise
     */
    public function isDefinedUse(string $name): bool
    {
        return $this->isDefinedAlias($name);
    }

    /** Undefine PHPSandbox use (or alias).
     *
     * You can pass a string of use (or alias) $name to undefine, or an array of use (or alias) names to undefine
     *
     * @param array|string $name String of use (or alias) name, or array of use (or alias) names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineUse($name): self
    {
        return $this->undefineAlias($name);
    }

    /** Undefine PHPSandbox uses (or aliases) by array.
     *
     * @alias   undefineAliases();
     *
     * You can pass an array of use (or alias) names to undefine, or an empty array or null argument to undefine all uses (or aliases)
     *
     * @param array $uses Array of use (or alias) names to undefine. Passing an empty array or no argument will result in undefining all uses (or aliases)
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineUses(array $uses = []): self
    {
        return $this->undefineAliases($uses);
    }

    /** Define PHPSandbox class.
     *
     * You can pass the class $name and $value to define, or an associative array of classes to define
     *
     * @param array|string $name String of class $name or associative array to define
     * @param mixed $value Value to define class to
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed class is defined
     */
    public function defineClass($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineClasses($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed class!', Error::DEFINE_CLASS_ERROR, null, '');
        }
        $name = $this->normalizeClass($name);
        $this->definitions[KeywordConstants::CLASSES][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox classes by array.
     *
     * You can pass an associative array of classes to define
     *
     * @param array $classes Associative array of $classes to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineClasses(array $classes = []): self
    {
        foreach ($classes as $name => $value) {
            $this->defineClass($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined classes.
     *
     * @return int Returns the number of classes this instance has defined
     */
    public function hasDefinedClasses(): int
    {
        return count($this->definitions[KeywordConstants::CLASSES]);
    }

    /** Check if PHPSandbox instance has $name class defined.
     *
     * @param string $name String of class $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined class, false otherwise
     */
    public function isDefinedClass($name): bool
    {
        $name = $this->normalizeClass($name);
        return isset($this->definitions[KeywordConstants::CLASSES][$name]);
    }

    /** Get defined class of $name.
     *
     * @param string $name String of class $name to get
     *
     * @return array|string Returns string of defined class value
     * @throws Throwable Throws an exception if an invalid class name is requested
     */
    public function getDefinedClass(?string $name = null): array|string
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::CLASSES];
        }
        $name = $this->normalizeClass($name);
        if (! isset($this->definitions[KeywordConstants::CLASSES][$name])) {
            $this->error->validationError("Could not get undefined class: {$name}", Error::VALID_CLASS_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::CLASSES][$name];
    }

    /** Undefine PHPSandbox class.
     *
     * You can pass a string of class $name to undefine, or an array of class names to undefine
     *
     * @param array|string $name String of class name or an array of class names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineClass($name): self
    {
        if (is_array($name)) {
            return $this->undefineClasses($name);
        }
        $name = $this->normalizeClass($name);
        if (isset($this->definitions[KeywordConstants::CLASSES][$name])) {
            unset($this->definitions[KeywordConstants::CLASSES][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox classes by array.
     *
     * You can pass an array of class names to undefine, or an empty array or null argument to undefine all classes
     *
     * @param array $classes Array of class names to undefine. Passing an empty array or no argument will result in undefining all classes
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineClasses(array $classes = []): self
    {
        if (count($classes)) {
            foreach ($classes as $class) {
                $this->undefineClass($class);
            }
        } else {
            $this->definitions[KeywordConstants::CLASSES] = [];
        }
        return $this;
    }

    /** Define PHPSandbox interface.
     *
     * You can pass the interface $name and $value to define, or an associative array of interfaces to define
     *
     * @param array|string $name String of interface $name or associative array to define
     * @param mixed $value Value to define interface to
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed interface is defined
     */
    public function defineInterface($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineInterfaces($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed interface!', Error::DEFINE_INTERFACE_ERROR, null, '');
        }
        $name = $this->normalizeInterface($name);
        $this->definitions[KeywordConstants::INTERFACES][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox interfaces by array.
     *
     * You can pass an associative array of interfaces to define
     *
     * @param array $interfaces Associative array of $interfaces to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed interface is defined
     */
    public function defineInterfaces(array $interfaces = []): self
    {
        foreach ($interfaces as $name => $value) {
            $this->defineInterface($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined interfaces.
     *
     * @return int Returns the number of interfaces this instance has defined
     */
    public function hasDefinedInterfaces(): int
    {
        return count($this->definitions[KeywordConstants::INTERFACES]);
    }

    /** Check if PHPSandbox instance has $name interface defined.
     *
     * @param string $name String of interface $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined interface, false otherwise
     */
    public function isDefinedInterface($name): bool
    {
        $name = $this->normalizeInterface($name);
        return isset($this->definitions[KeywordConstants::INTERFACES][$name]);
    }

    /** Get defined interface of $name.
     *
     * @param string $name String of interface $name to get
     *
     * @return array|string Returns string of defined interface value
     * @throws Throwable Throws an exception if an invalid interface name is requested
     */
    public function getDefinedInterface(?string $name = null): array|string
    {
        if (! $name) {
            return $this->definitions[KeywordConstants::INTERFACES];
        }
        $name = $this->normalizeInterface($name);
        if (! isset($this->definitions[KeywordConstants::INTERFACES][$name])) {
            $this->error->validationError("Could not get undefined interface: {$name}", Error::VALID_INTERFACE_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::INTERFACES][$name];
    }

    /** Undefine PHPSandbox interface.
     *
     * You can pass a string of interface $name to undefine, or an array of interface names to undefine
     *
     * @param array|string $name String of interface name or an array of interface names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineInterface($name): self
    {
        if (is_array($name)) {
            return $this->undefineInterfaces($name);
        }
        $name = $this->normalizeInterface($name);
        if (isset($this->definitions[KeywordConstants::INTERFACES][$name])) {
            unset($this->definitions[KeywordConstants::INTERFACES][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox interfaces by array.
     *
     * You can pass an array of interface names to undefine, or an empty array or null argument to undefine all interfaces
     *
     * @param array $interfaces Array of interface names to undefine. Passing an empty array or no argument will result in undefining all interfaces
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineInterfaces(array $interfaces = []): self
    {
        if (count($interfaces)) {
            foreach ($interfaces as $interface) {
                $this->undefineInterface($interface);
            }
        } else {
            $this->definitions[KeywordConstants::INTERFACES] = [];
        }
        return $this;
    }

    /** Define PHPSandbox trait.
     *
     * You can pass the trait $name and $value to define, or an associative array of traits to define
     *
     * @param array|string $name String of trait $name or associative array to define
     * @param mixed $value Value to define trait to
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     * @throws Throwable Throws exception if unnamed trait is defined
     */
    public function defineTrait($name, $value): self
    {
        if (is_array($name)) {
            return $this->defineTraits($name);
        }
        if (! $name) {
            $this->error->validationError('Cannot define unnamed trait!', Error::DEFINE_TRAIT_ERROR, null, '');
        }
        $name = $this->normalizeTrait($name);
        $this->definitions[KeywordConstants::TRAITS][$name] = $value;
        return $this;
    }

    /** Define PHPSandbox traits by array.
     *
     * You can pass an associative array of traits to define
     *
     * @param array $traits Associative array of $traits to define
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function defineTraits(array $traits = []): self
    {
        foreach ($traits as $name => $value) {
            $this->defineTrait($name, $value);
        }
        return $this;
    }

    /** Query whether PHPSandbox instance has defined traits.
     *
     * @return int Returns the number of traits this instance has defined
     */
    public function hasDefinedTraits(): int
    {
        return count($this->definitions[KeywordConstants::TRAITS]);
    }

    /** Check if PHPSandbox instance has $name trait defined.
     *
     * @param string $name String of trait $name to query
     *
     * @return bool Returns true if PHPSandbox instance has defined trait, false otherwise
     */
    public function isDefinedTrait(string $name): bool
    {
        $name = $this->normalizeTrait($name);
        return isset($this->definitions[KeywordConstants::TRAITS][$name]);
    }

    /** Get defined trait of $name.
     *
     * @param string $name String of trait $name to get
     *
     * @return array|string Returns string of defined trait value
     * @throws Throwable Throws an exception if an invalid trait name is requested
     */
    public function getDefinedTrait(?string $name = null): array|string
    {
        if ($name === null) {
            return $this->definitions[KeywordConstants::TRAITS];
        }
        $name = $this->normalizeTrait($name);
        if (! isset($this->definitions[KeywordConstants::TRAITS][$name])) {
            $this->error->validationError("Could not get undefined trait: {$name}", Error::VALID_TRAIT_ERROR, null, $name);
        }
        return $this->definitions[KeywordConstants::TRAITS][$name];
    }

    /** Undefine PHPSandbox trait.
     *
     * You can pass a string of trait $name to undefine, or an array of trait names to undefine
     *
     * @param array|string $name String of trait name or an array of trait names to undefine
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineTrait($name): self
    {
        if (is_array($name)) {
            return $this->undefineTraits($name);
        }
        $name = $this->normalizeTrait($name);
        if (isset($this->definitions[KeywordConstants::TRAITS][$name])) {
            unset($this->definitions[KeywordConstants::TRAITS][$name]);
        }
        return $this;
    }

    /** Undefine PHPSandbox traits by array.
     *
     * You can pass an array of trait names to undefine, or an empty array or null argument to undefine all traits
     *
     * @param array $traits Array of trait names to undefine. Passing an empty array or no argument will result in undefining all traits
     *
     * @return Definitions Returns the PHPSandbox instance for fluent querying
     */
    public function undefineTraits(array $traits = []): self
    {
        if (count($traits)) {
            foreach ($traits as $trait) {
                $this->undefineTrait($trait);
            }
        } else {
            $this->definitions[KeywordConstants::TRAITS] = [];
        }
        return $this;
    }
}
