<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

use PHPSandbox\Constants\ValidationConstants;

class Validation
{
    use NormalizeTrait;

    /**
     * @var array Array of custom validation functions
     */
    protected array $validation = [
        ValidationConstants::FUNCTION => null,
        ValidationConstants::VARIABLE => null,
        ValidationConstants::GLOBAL => null,
        ValidationConstants::SUPERGLOBAL => null,
        ValidationConstants::CONSTANT => null,
        ValidationConstants::MAGIC_CONSTANT => null,
        ValidationConstants::NAMESPACE => null,
        ValidationConstants::ALIAS => null,
        ValidationConstants::_CLASS => null,
        ValidationConstants::INTERFACE => null,
        ValidationConstants::TRAIT => null,
        ValidationConstants::KEYWORD => null,
        ValidationConstants::OPERATOR => null,
        ValidationConstants::PRIMITIVE => null,
        ValidationConstants::TYPE => null,
    ];

    /** Set validation callable for specified $type.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param string $type String of $type name to set validator for
     * @param callable $callable Callable that validates the passed element
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setValidator(string $type, callable $callable): self
    {
        $type = strtolower($type);  // normalize type
        if (array_key_exists($type, $this->validation)) {
            $this->validation[$type] = $callable;
        }
        return $this;
    }

    /** Get validation callable for specified $type.
     *
     * @param string $type String of $type to return
     */
    public function getValidator(string $type): ?callable
    {
        return $this->validation[strtolower($type)] ?? null;
    }

    /** Unset validation callable for specified $type.
     *
     * @param string $type String of $type to unset
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetValidator(string $type): self
    {
        $type = strtolower($type);  // normalize type
        if (isset($this->validation[$type])) {
            $this->validation[$type] = null;
        }
        return $this;
    }

    /** Set validation callable for functions.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized function names include the namespace and are lowercase!
     *
     * @param callable $callable Callable that validates the normalized passed function name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setFuncValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::FUNCTION] = $callable;
        return $this;
    }

    /** Get validation for functions.
     *
     */
    public function getFuncValidator(): ?callable
    {
        return $this->validation[ValidationConstants::FUNCTION] ?? null;
    }

    /** Unset validation callable for functions.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetFuncValidator(): self
    {
        $this->validation[ValidationConstants::FUNCTION] = null;
        return $this;
    }

    /** Set validation callable for variables.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed variable name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setVarValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::VARIABLE] = $callable;
        return $this;
    }

    /** Get validation callable for variables.
     *
     */
    public function getVarValidator(): ?callable
    {
        return $this->validation[ValidationConstants::VARIABLE] ?? null;
    }

    /** Unset validation callable for variables.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetVarValidator(): self
    {
        $this->validation[ValidationConstants::VARIABLE] = null;
        return $this;
    }

    /** Set validation callable for globals.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed global name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setGlobalValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::GLOBAL] = $callable;
        return $this;
    }

    /** Get validation callable for globals.
     *
     */
    public function getGlobalValidator(): ?callable
    {
        return $this->validation[ValidationConstants::GLOBAL] ?? null;
    }

    /** Unset validation callable for globals.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetGlobalValidator(): self
    {
        $this->validation[ValidationConstants::GLOBAL] = null;
        return $this;
    }

    /** Set validation callable for superglobals.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized superglobal names are uppercase and without a leading _
     *
     * @param callable $callable Callable that validates the passed superglobal name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setSuperglobalValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::SUPERGLOBAL] = $callable;
        return $this;
    }

    /** Get validation callable for superglobals.
     *
     */
    public function getSuperglobalValidator(): ?callable
    {
        return $this->validation[ValidationConstants::SUPERGLOBAL] ?? null;
    }

    /** Unset validation callable for superglobals.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetSuperglobalValidator(): self
    {
        $this->validation[ValidationConstants::SUPERGLOBAL] = null;
        return $this;
    }

    /** Set validation callable for constants.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed constant name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setConstValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::CONSTANT] = $callable;
        return $this;
    }

    /** Get validation callable for constants.
     *
     */
    public function getConstValidator(): ?callable
    {
        return $this->validation[ValidationConstants::CONSTANT] ?? null;
    }

    /** Unset validation callable for constants.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetConstValidator(): self
    {
        $this->validation[ValidationConstants::CONSTANT] = null;
        return $this;
    }

    /** Set validation callable for magic constants.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized magic constant names are upper case and trimmed of __
     *
     * @param callable $callable Callable that validates the passed magic constant name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setMagicConstValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::MAGIC_CONSTANT] = $callable;
        return $this;
    }

    /** Get validation callable for magic constants.
     *
     */
    public function getMagicConstValidator(): ?callable
    {
        return $this->validation[ValidationConstants::MAGIC_CONSTANT] ?? null;
    }

    /** Unset validation callable for magic constants.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetMagicConstValidator(): self
    {
        $this->validation[ValidationConstants::MAGIC_CONSTANT] = null;
        return $this;
    }

    /** Set validation callable for namespaces.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed namespace name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setNamespaceValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::NAMESPACE] = $callable;
        return $this;
    }

    /** Get validation callable for namespaces.
     *
     */
    public function getNamespaceValidator(): ?callable
    {
        return $this->validation[ValidationConstants::NAMESPACE] ?? null;
    }

    /** Unset validation callable for namespaces.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetNamespaceValidator(): self
    {
        $this->validation[ValidationConstants::NAMESPACE] = null;
        return $this;
    }

    /** Set validation callable for uses (aka aliases).
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @alias setAliasValidator();
     *
     * @param callable $callable Callable that validates the passed use (aka alias) name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setUseValidator(callable $callable): self
    {
        return $this->setAliasValidator($callable);
    }

    /** Set validation callable for aliases.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed alias name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setAliasValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::ALIAS] = $callable;
        return $this;
    }

    /** Get validation callable for uses (aka aliases).
     *
     * @alias getAliasValidator();
     */
    public function getUseValidator(): ?callable
    {
        return $this->getAliasValidator();
    }

    /** Get validation callable for aliases.
     *
     */
    public function getAliasValidator(): ?callable
    {
        return $this->validation[ValidationConstants::ALIAS] ?? null;
    }

    /** Unset validation callable for uses (aka aliases).
     *
     * @alias unsetAliasValidator();
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetUseValidator(): self
    {
        return $this->unsetAliasValidator();
    }

    /** Unset validation callable for aliases.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetAliasValidator(): self
    {
        $this->validation[ValidationConstants::ALIAS] = null;
        return $this;
    }

    /** Set validation callable for classes.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized class names are lowercase
     *
     * @param callable $callable Callable that validates the passed class name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setClassValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::_CLASS] = $callable;
        return $this;
    }

    /** Get validation callable for classes.
     *
     */
    public function getClassValidator(): ?callable
    {
        return $this->validation[ValidationConstants::_CLASS] ?? null;
    }

    /** Unset validation callable for classes.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetClassValidator(): self
    {
        $this->validation[ValidationConstants::_CLASS] = null;
        return $this;
    }

    /** Set validation callable for interfaces.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized interface names are lowercase
     *
     * @param callable $callable Callable that validates the passed interface name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setInterfaceValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::INTERFACE] = $callable;
        return $this;
    }

    /** Get validation callable for interfaces.
     *
     */
    public function getInterfaceValidator(): ?callable
    {
        return $this->validation[ValidationConstants::INTERFACE] ?? null;
    }

    /** Unset validation callable for interfaces.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetInterfaceValidator(): self
    {
        $this->validation[ValidationConstants::INTERFACE] = null;
        return $this;
    }

    /** Set validation callable for traits.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance. NOTE: Normalized trait names are lowercase
     *
     * @param callable $callable Callable that validates the passed trait name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setTraitValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::TRAIT] = $callable;
        return $this;
    }

    /** Get validation callable for traits.
     *
     */
    public function getTraitValidator(): ?callable
    {
        return $this->validation[ValidationConstants::TRAIT] ?? null;
    }

    /** Unset validation callable for traits.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetTraitValidator(): self
    {
        $this->validation[ValidationConstants::TRAIT] = null;
        return $this;
    }

    /** Set validation callable for keywords.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed keyword name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setKeywordValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::KEYWORD] = $callable;
        return $this;
    }

    /** Get validation callable for keywords.
     *
     */
    public function getKeywordValidator(): ?callable
    {
        return $this->validation[ValidationConstants::KEYWORD] ?? null;
    }

    /** Unset validation callable for keywords.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetKeywordValidator(): self
    {
        $this->validation[ValidationConstants::KEYWORD] = null;
        return $this;
    }

    /** Set validation callable for operators.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed operator name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setOperatorValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::OPERATOR] = $callable;
        return $this;
    }

    /** Get validation callable for operators.
     *
     */
    public function getOperatorValidator(): ?callable
    {
        return $this->validation[ValidationConstants::OPERATOR] ?? null;
    }

    /** Unset validation callable for operators.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetOperatorValidator(): self
    {
        $this->validation[ValidationConstants::OPERATOR] = null;
        return $this;
    }

    /** Set validation callable for primitives.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed primitive name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setPrimitiveValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::PRIMITIVE] = $callable;
        return $this;
    }

    /** Get validation callable for primitives.
     *
     */
    public function getPrimitiveValidator(): ?callable
    {
        return $this->validation[ValidationConstants::PRIMITIVE] ?? null;
    }

    /** Unset validation callable for primitives.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetPrimitiveValidator(): self
    {
        $this->validation[ValidationConstants::PRIMITIVE] = null;
        return $this;
    }

    /** Set validation callable for types.
     *
     * Validator callable must accept two parameters: a string of the normalized name of the checked element,
     * and the PHPSandbox instance
     *
     * @param callable $callable Callable that validates the passed type name
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function setTypeValidator(callable $callable): self
    {
        $this->validation[ValidationConstants::TYPE] = $callable;
        return $this;
    }

    /** Get validation callable for types.
     *
     */
    public function getTypeValidator(): ?callable
    {
        return $this->validation[ValidationConstants::TYPE] ?? null;
    }

    /** Unset validation callable for types.
     *
     * @return Validation Returns the Validation instance for fluent querying
     */
    public function unsetTypeValidator(): self
    {
        $this->validation[ValidationConstants::TYPE] = null;
        return $this;
    }
}
