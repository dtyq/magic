<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Validation;

use Closure;
use PHPSandbox\Error;
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\Options\ValidationError;
use PHPSandbox\SandboxedString;
use Throwable;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class Validator
{
    protected SandboxOptions $options;

    protected ValidationError $error;

    public function __construct(
        SandboxOptions $options
    ) {
        $this->options = $options;
        $this->error = $this->options->getValidationError();
    }

    /** Check function name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param Closure|SandboxedString|string $name String of the function name to check
     *
     * @return bool Returns true if function is valid, this is also used for testing closures
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkFunc($name): bool
    {
        if (! $this->options->isValidateFunctions()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof Closure) {
            if (! $this->options->isAllowClosures()) {
                $this->error->validationError('Sandboxed code attempted to call closure!', Error::CLOSURE_ERROR);
            }
            return true;
        }
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name || ! is_string($name)) {
            $this->error->validationError('Sandboxed code attempted to call unnamed function!', Error::VALID_FUNC_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getFuncValidator())) {
            return call_user_func_array($this->options->validation()->getFuncValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedFunc($name) || ! is_callable($this->options->definitions()->getDefinedFunc($name, 'function'))) {
            if ($this->options->accessControl()->hasWhitelistedFuncs()) {
                if (! $this->options->accessControl()->isWhitelistedFunc($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted function: {$original_name}", Error::WHITELIST_FUNC_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedFuncs()) {
                if ($this->options->accessControl()->isBlacklistedFunc($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted function: {$original_name}", Error::BLACKLIST_FUNC_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid function: {$original_name}", Error::VALID_FUNC_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check keyword name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the keyword name to check
     *
     * @return bool Returns true if keyword is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkKeyword($name): bool
    {
        if (! $this->options->isValidateKeywords()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed keyword!', Error::VALID_KEYWORD_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getKeywordValidator())) {
            return call_user_func_array($this->options->validation()->getKeywordValidator(), [$name, $this]);
        }
        if ($this->options->accessControl()->hasWhitelistKeywords()) {
            if (! $this->options->accessControl()->isWhitelistedKeyword($name)) {
                $this->error->validationError("Sandboxed code attempted to call non-whitelisted keyword: {$original_name}", Error::WHITELIST_KEYWORD_ERROR, null, $original_name);
            }
        } elseif ($this->options->accessControl()->hasBlacklistedKeywords()) {
            if ($this->options->accessControl()->isBlacklistedKeyword($name)) {
                $this->error->validationError("Sandboxed code attempted to call blacklisted keyword: {$original_name}", Error::BLACKLIST_KEYWORD_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check class name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the class name to check
     * @param bool $extends Flag whether this is an extended class
     *
     * @return bool Returns true if class is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkClass($name, bool $extends = false): bool
    {
        if (! $this->options->isValidateClasses()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        $action = $extends ? 'extend' : 'call';
        if (! $name) {
            $this->error->validationError("Sandboxed code attempted to {$action} unnamed class!", Error::VALID_CLASS_ERROR, null, '');
        }
        if ($name == 'self' || $name == 'static' || $name == 'parent') {
            return true;
        }
        if (is_callable($this->options->validation()->getClassValidator())) {
            return call_user_func_array($this->options->validation()->getClassValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedClass($name)) {
            if ($this->options->accessControl()->hasWhitelistedClasses()) {
                if (! $this->options->accessControl()->isWhitelistedClass($name)) {
                    $this->error->validationError("Sandboxed code attempted to {$action} non-whitelisted class: {$original_name}", Error::WHITELIST_CLASS_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedClasses()) {
                if ($this->options->accessControl()->isBlacklistedClass($name)) {
                    $this->error->validationError("Sandboxed code attempted to {$action} blacklisted class: {$original_name}", Error::BLACKLIST_CLASS_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to {$action} invalid class: {$original_name}", Error::VALID_CLASS_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check interface name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the interface name to check
     *
     * @return bool Returns true if interface is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkInterface($name): bool
    {
        if (! $this->options->isValidateInterfaces()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed interface!', Error::VALID_INTERFACE_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getInterfaceValidator())) {
            return call_user_func_array($this->options->validation()->getInterfaceValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedInterface($name)) {
            if ($this->options->accessControl()->hasWhitelistedInterfaces()) {
                if (! $this->options->accessControl()->isWhitelistedInterface($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted interface: {$original_name}", Error::WHITELIST_INTERFACE_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedInterfaces()) {
                if ($this->options->accessControl()->isBlacklistedInterface($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted interface: {$original_name}", Error::BLACKLIST_INTERFACE_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid interface: {$original_name}", Error::VALID_INTERFACE_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check type name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the type name to check
     *
     * @return bool Returns true if type is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkType($name): bool
    {
        if (! $this->options->isValidateTypes()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed type!', Error::VALID_TYPE_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getTypeValidator())) {
            return call_user_func_array($this->options->validation()->getTypeValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedClass($name)) {
            if ($this->options->accessControl()->hasWhitelistedTypes()) {
                if (! $this->options->accessControl()->isWhitelistedType($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted type: {$original_name}", Error::WHITELIST_TYPE_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedTypes()) {
                if ($this->options->accessControl()->isBlacklistedType($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted type: {$original_name}", Error::BLACKLIST_TYPE_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid type: {$original_name}", Error::VALID_TYPE_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check trait name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the trait name to check
     *
     * @return bool Returns true if trait is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkTrait($name): bool
    {
        if (! $this->options->isValidateTraits()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed trait!', Error::VALID_TRAIT_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getTraitValidator())) {
            return call_user_func_array($this->options->validation()->getTraitValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedTrait($name)) {
            if ($this->options->accessControl()->hasWhitelistedTraits()) {
                if (! $this->options->accessControl()->isWhitelistedTrait($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted trait: {$original_name}", Error::WHITELIST_TRAIT_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedTraits()) {
                if ($this->options->accessControl()->isBlacklistedTrait($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted trait: {$original_name}", Error::BLACKLIST_TRAIT_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid trait: {$original_name}", Error::VALID_TRAIT_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check global name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the global name to check
     *
     * @return bool Returns true if global is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkGlobal($name): bool
    {
        if (! $this->options->isValidateGlobals()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed global!', Error::VALID_GLOBAL_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getGlobalValidator())) {
            return call_user_func_array($this->options->validation()->getGlobalValidator(), [$name, $this]);
        }
        if ($this->options->accessControl()->hasWhitelistedGlobals()) {
            if (! $this->options->accessControl()->isWhitelistedGlobal($name)) {
                $this->error->validationError("Sandboxed code attempted to call non-whitelisted global: {$original_name}", Error::WHITELIST_GLOBAL_ERROR, null, $original_name);
            }
        } elseif ($this->options->accessControl()->hasBlacklistedGlobals()) {
            if ($this->options->accessControl()->isBlacklistedGlobal($name)) {
                $this->error->validationError("Sandboxed code attempted to call blacklisted global: {$original_name}", Error::BLACKLIST_GLOBAL_ERROR, null, $original_name);
            }
        } else {
            $this->error->validationError("Sandboxed code attempted to call invalid global: {$original_name}", Error::VALID_GLOBAL_ERROR, null, $original_name);
        }
        return true;
    }

    /** Check superglobal name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the superglobal name to check
     *
     * @return bool Returns true if superglobal is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkSuperglobal($name): bool
    {
        if (! $this->options->isValidateSuperglobals()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed superglobal!', Error::VALID_SUPERGLOBAL_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getSuperglobalValidator())) {
            return call_user_func_array($this->options->validation()->getSuperglobalValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedSuperglobal($name)) {
            if ($this->options->accessControl()->hasWhitelistedSuperglobals()) {
                if (! $this->options->accessControl()->isWhitelistedSuperglobal($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted superglobal: {$original_name}", Error::WHITELIST_SUPERGLOBAL_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedSuperglobals()) {
                if ($this->options->accessControl()->isBlacklistedSuperglobal($name) && ! $this->options->accessControl()->hasBlacklistedSuperglobals($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted superglobal: {$original_name}", Error::BLACKLIST_SUPERGLOBAL_ERROR, null, $original_name);
                }
            } elseif (! $this->options->isOverwriteSuperglobals()) {
                $this->error->validationError("Sandboxed code attempted to call invalid superglobal: {$original_name}", Error::VALID_SUPERGLOBAL_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check variable name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the variable name to check
     * @return bool Returns true if variable is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkVar($name): bool
    {
        if (! $this->options->isValidateVariables()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed variable!', Error::VALID_VAR_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getVarValidator())) {
            return call_user_func_array($this->options->validation()->getVarValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedVar($name)) {
            if ($this->options->accessControl()->hasWhitelistedVars()) {
                if (! $this->options->accessControl()->isWhitelistedVar($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted variable: {$original_name}", Error::WHITELIST_VAR_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedVars()) {
                if ($this->options->accessControl()->isBlacklistedVar($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted variable: {$original_name}", Error::BLACKLIST_VAR_ERROR, null, $original_name);
                }
            } elseif (! $this->options->isAllowVariables()) {
                $this->error->validationError("Sandboxed code attempted to call invalid variable: {$original_name}", Error::VALID_VAR_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check constant name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the constant name to check
     *
     * @return bool Returns true if constant is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkConst($name): bool
    {
        if (! $this->options->isValidateConstants()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed constant!', Error::VALID_CONST_ERROR, null, '');
        }
        if (strtolower($name) === 'true' || strtolower($name) === 'false') {
            return $this->checkPrimitive('bool');
        }
        if (strtolower($name) === 'null') {
            return $this->checkPrimitive('null');
        }
        if (is_callable($this->options->validation()->getConstValidator())) {
            return call_user_func_array($this->options->validation()->getConstValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedConst($name)) {
            if ($this->options->accessControl()->hasWhitelistedConsts()) {
                if (! $this->options->accessControl()->isWhitelistedConst($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted constant: {$original_name}", Error::WHITELIST_CONST_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedConsts()) {
                if ($this->options->accessControl()->isBlacklistedConst($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted constant: {$original_name}", Error::BLACKLIST_CONST_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid constant: {$original_name}", Error::VALID_CONST_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check primitive name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the primitive name to check
     *
     * @return bool Returns true if primitive is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkPrimitive($name): bool
    {
        if (! $this->options->isValidatePrimitives()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed primitive!', Error::VALID_PRIMITIVE_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getPrimitiveValidator())) {
            return call_user_func_array($this->options->validation()->getPrimitiveValidator(), [$name, $this]);
        }
        if ($this->options->accessControl()->hasWhitelistedPrimitives()) {
            if (! $this->options->accessControl()->isWhitelistedPrimitive($name)) {
                $this->error->validationError("Sandboxed code attempted to call non-whitelisted primitive: {$original_name}", Error::WHITELIST_PRIMITIVE_ERROR, null, $original_name);
            }
        } elseif ($this->options->accessControl()->hasBlacklistedPrimitives()) {
            if ($this->options->accessControl()->isBlacklistedPrimitive($name)) {
                $this->error->validationError("Sandboxed code attempted to call blacklisted primitive: {$original_name}", Error::BLACKLIST_PRIMITIVE_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check namespace name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the namespace name to check
     *
     * @return bool Returns true if namespace is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkNamespace($name): bool
    {
        if (! $this->options->isValidateNamespaces()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed namespace!', Error::VALID_NAMESPACE_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getNamespaceValidator())) {
            return call_user_func_array($this->options->validation()->getNamespaceValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedNamespace($name)) {
            if ($this->options->accessControl()->hasWhitelistedNamespaces()) {
                if (! $this->options->accessControl()->isWhitelistedNamespace($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted namespace: {$original_name}", Error::WHITELIST_NAMESPACE_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedNamespaces()) {
                if ($this->options->accessControl()->isBlacklistedNamespace($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted namespace: {$original_name}", Error::BLACKLIST_NAMESPACE_ERROR, null, $original_name);
                }
            } elseif (! $this->options->isAllowNamespaces()) {
                $this->error->validationError("Sandboxed code attempted to call invalid namespace: {$original_name}", Error::VALID_NAMESPACE_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check alias name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the alias name to check
     *
     * @return bool Returns true if alias is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkAlias($name): bool
    {
        if (! $this->options->isValidateAliases()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed alias!', Error::VALID_ALIAS_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getAliasValidator())) {
            return call_user_func_array($this->options->validation()->getAliasValidator(), [$name, $this]);
        }
        if ($this->options->accessControl()->hasWhitelistedAliases()) {
            if (! $this->options->accessControl()->isWhitelistedAlias($name)) {
                $this->error->validationError("Sandboxed code attempted to call non-whitelisted alias: {$original_name}", Error::WHITELIST_ALIAS_ERROR, null, $original_name);
            }
        } elseif ($this->options->accessControl()->hasBlacklistedAliases()) {
            if ($this->options->accessControl()->isBlacklistedAlias($name)) {
                $this->error->validationError("Sandboxed code attempted to call blacklisted alias: {$original_name}", Error::BLACKLIST_ALIAS_ERROR, null, $original_name);
            }
        } elseif (! $this->options->isAllowAliases()) {
            $this->error->validationError("Sandboxed code attempted to call invalid alias: {$original_name}", Error::VALID_ALIAS_ERROR, null, $original_name);
        }
        return true;
    }

    /** Check magic constant name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the magic constant name to check
     *
     * @return bool Returns true if magic constant is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkMagicConst($name): bool
    {
        if (! $this->options->isValidateMagicConstants()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed magic constant!', Error::VALID_MAGIC_CONST_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getMagicConstValidator())) {
            return call_user_func_array($this->options->validation()->getMagicConstValidator(), [$name, $this]);
        }
        if (! $this->options->definitions()->isDefinedMagicConst($name)) {
            if ($this->options->accessControl()->hasWhitelistedMagicConsts()) {
                if (! $this->options->accessControl()->isWhitelistedMagicConst($name)) {
                    $this->error->validationError("Sandboxed code attempted to call non-whitelisted magic constant: {$original_name}", Error::WHITELIST_MAGIC_CONST_ERROR, null, $original_name);
                }
            } elseif ($this->options->accessControl()->hasBlacklistedMagicConsts()) {
                if ($this->options->accessControl()->isBlacklistedMagicConst($name)) {
                    $this->error->validationError("Sandboxed code attempted to call blacklisted magic constant: {$original_name}", Error::BLACKLIST_MAGIC_CONST_ERROR, null, $original_name);
                }
            } else {
                $this->error->validationError("Sandboxed code attempted to call invalid magic constant: {$original_name}", Error::VALID_MAGIC_CONST_ERROR, null, $original_name);
            }
        }
        return true;
    }

    /** Check use (or alias) name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     *
     * @alias checkAlias();
     *
     * @param string $name String of the use (or alias) name to check
     *
     * @return bool Returns true if use (or alias) is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkUse(string $name): bool
    {
        return $this->checkAlias($name);
    }

    /** Check operator name against PHPSandbox validation rules. This is an internal PHPSandbox function but requires public access to work.
     * @param mixed $name of the type operator to check
     *
     * @return bool Returns true if operator is valid
     * @throws Throwable Throws exception if validation error occurs
     */
    public function checkOperator($name): bool
    {
        if (! $this->options->isValidateOperators()) {
            return true;
        }
        $original_name = $name;
        if ($name instanceof SandboxedString) {
            $name = strval($name);
        }
        if (! $name) {
            $this->error->validationError('Sandboxed code attempted to call unnamed operator!', Error::VALID_OPERATOR_ERROR, null, '');
        }
        if (is_callable($this->options->validation()->getOperatorValidator())) {
            return call_user_func_array($this->options->validation()->getOperatorValidator(), [$name, $this]);
        }
        if ($this->options->accessControl()->hasWhitelistedOperators()) {
            if (! $this->options->accessControl()->isWhitelistedOperator($name)) {
                $this->error->validationError("Sandboxed code attempted to call non-whitelisted operator: {$original_name}", Error::WHITELIST_OPERATOR_ERROR, null, $original_name);
            }
        } elseif ($this->options->accessControl()->hasBlacklistedOperators()) {
            if ($this->options->accessControl()->isBlacklistedOperator($name)) {
                $this->error->validationError("Sandboxed code attempted to call blacklisted operator: {$original_name}", Error::BLACKLIST_OPERATOR_ERROR, null, $original_name);
            }
        }
        return true;
    }
}
