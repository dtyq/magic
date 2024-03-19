<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime\Proxy;

use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use Throwable;

/**
 * 提取自原有 PHPSandbox 内置方法.
 * @internal
 */
class DefinedFunctions implements RuntimeProxyInterface
{
    /**
     * @static
     * @var array A static array of defined_* and declared_* functions names used for redefining defined_* and declared_* values
     */
    public static array $defined_funcs = [
        'get_defined_functions',
        'get_defined_vars',
        'get_defined_constants',
        'get_declared_classes',
        'get_declared_interfaces',
        'get_declared_traits',
        'get_included_files',
    ];

    protected SandboxOptions $options;

    public function setOptions(SandboxOptions $options): self
    {
        $this->options = $options;
        return $this;
    }

    public static function isDefinedFunc($name): bool
    {
        return in_array($name, self::$defined_funcs);
    }

    /** Get PHPSandbox redefined functions in place of get_defined_functions(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $functions Array result from get_defined_functions() is passed here
     *
     * @return array Returns the redefined functions array
     */
    public function _get_defined_functions(array $functions = []): array
    {
        if ($this->options->accessControl()->hasWhitelistedFuncs()) {
            $functions = [];
            foreach ($this->options->accessControl()->getWhitelistedFunc() as $name => $value) {
                if ($this->options->definitions()->isDefinedFunc($name) && is_callable($this->options->definitions()->getDefinedFunc($name))) {
                    $functions[$name] = $name;
                } elseif (is_callable($name) && is_string($name)) {
                    $functions[$name] = $name;
                }
            }
            foreach ($this->options->definitions()->getDefinedFunc() as $name => $function) {
                if (is_callable($function)) {
                    $functions[$name] = $name;
                }
            }
            return array_values($functions);
        }
        if ($this->options->accessControl()->hasBlacklistedFuncs()) {
            foreach ($functions as $index => $name) {
                if ($this->options->accessControl()->isBlacklistedFunc($name)) {
                    unset($functions[$index]);
                }
            }
            reset($functions);
            return $functions;
        }
        return [];
    }

    /** Get PHPSandbox redefined variables in place of get_defined_vars(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $variables Array result from get_defined_vars() is passed here
     *
     * @return array Returns the redefined variables array
     */
    public function _get_defined_vars(array $variables = []): array
    {
        foreach ($variables as $name => $variable) {
            if (in_array($name, PHPSandbox::$inner_variable)) {
                unset($variables[$name]); // hi
            }
        }

        return $variables;
    }

    /** Get PHPSandbox redefined constants in place of get_defined_constants(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $constants Array result from get_defined_constants() is passed here
     *
     * @return array Returns the redefined constants
     */
    public function _get_defined_constants(array $constants = []): array
    {
        if ($this->options->accessControl()->hasWhitelistedConsts()) {
            $constants = [];
            foreach ($this->options->accessControl()->getWhitelistedConst() as $name => $value) {
                if (defined($name)) {
                    $constants[$name] = $name;
                }
            }
            foreach ($this->options->definitions()->getDefinedConsts() as $name => $value) {
                if (defined($name)) { // these shouldn't be undefined, but just in case they are we don't want to report inaccurate information
                    $constants[$name] = $name;
                }
            }
            return array_values($constants);
        }
        if ($this->options->accessControl()->hasBlacklistedConsts()) {
            foreach ($constants as $index => $name) {
                if ($this->options->accessControl()->isBlacklistedConst($name)) {
                    unset($constants[$index]);
                }
            }
            reset($constants);
            return $constants;
        }
        return [];
    }

    /** Get PHPSandbox redefined classes in place of get_declared_classes(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $classes Array result from get_declared_classes() is passed here
     *
     * @return array Returns the redefined classes
     */
    public function _get_declared_classes(array $classes = []): array
    {
        if ($this->options->accessControl()->hasWhitelistedClasses()) {
            $classes = [];
            foreach ($this->options->accessControl()->getWhitelistedClass() as $name => $value) {
                if (class_exists($name)) {
                    $classes[strtolower($name)] = $name;
                }
            }
            foreach ($this->options->definitions()->getDefinedClass() as $name => $value) {
                if (class_exists($value)) {
                    $classes[strtolower($name)] = $value;
                }
            }
            return array_values($classes);
        }
        if ($this->options->accessControl()->hasBlacklistedClasses()) {
            $valid_classes = [];
            foreach ($classes as $class) {
                $valid_classes[strtolower($class)] = $class;
            }
            foreach ($this->options->definitions()->getDefinedClass() as $name => $value) {
                if (class_exists($value)) {
                    $valid_classes[strtolower($name)] = $value;
                }
            }
            foreach ($valid_classes as $index => $name) {
                if ($this->options->accessControl()->isBlacklistedClass($name)) {
                    unset($valid_classes[$index]);
                }
            }
            return array_values($classes);
        }
        $classes = [];
        foreach ($this->options->definitions()->getDefinedClass() as $value) {
            if (class_exists($value)) {
                $classes[strtolower($value)] = $value;
            }
        }
        return array_values($classes);
    }

    /** Get PHPSandbox redefined interfaces in place of get_declared_interfaces(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $interfaces Array result from get_declared_interfaces() is passed here
     *
     * @return array Returns the redefined interfaces
     */
    public function _get_declared_interfaces(array $interfaces = []): array
    {
        if ($this->options->accessControl()->hasWhitelistedInterfaces()) {
            $interfaces = [];
            foreach ($this->options->accessControl()->getWhitelistedInterfaces() as $name => $value) {
                if (interface_exists($name)) {
                    $interfaces[strtolower($name)] = $name;
                }
            }
            foreach ($this->options->definitions()->getDefinedInterface() as $name => $value) {
                if (interface_exists($value)) {
                    $interfaces[strtolower($name)] = $value;
                }
            }
            return array_values($interfaces);
        }
        if ($this->options->accessControl()->hasBlacklistedInterfaces()) {
            $valid_interfaces = [];
            foreach ($interfaces as $interface) {
                $valid_interfaces[strtolower($interface)] = $interface;
            }
            foreach ($this->options->definitions()->getDefinedInterface() as $name => $value) {
                if (interface_exists($value)) {
                    $valid_interfaces[strtolower($name)] = $value;
                }
            }
            foreach ($valid_interfaces as $index => $name) {
                if ($this->options->accessControl()->isBlacklistedInterface($name)) {
                    unset($valid_interfaces[$index]);
                }
            }
            return array_values($interfaces);
        }
        $interfaces = [];
        foreach ($this->options->definitions()->getDefinedInterface() as $value) {
            if (interface_exists($value)) {
                $interfaces[strtolower($value)] = $value;
            }
        }
        return array_values($interfaces);
    }

    /** Get PHPSandbox redefined traits in place of get_declared_traits(). This is an internal PHPSandbox function but requires public access to work.
     *
     * @param array $traits Array result from get_declared_traits() is passed here
     *
     * @return array Returns the redefined traits
     * @throws Throwable
     */
    public function _get_declared_traits(array $traits = []): array
    {
        if ($this->options->accessControl()->hasWhitelistedTraits()) {
            $traits = [];
            foreach ($this->options->accessControl()->getWhitelistedTraits() as $name => $value) {
                if (trait_exists($name)) {
                    $traits[strtolower($name)] = $name;
                }
            }
            foreach ($this->options->definitions()->getDefinedTrait() as $name => $value) {
                if (trait_exists($value)) {
                    $traits[strtolower($name)] = $value;
                }
            }
            return array_values($traits);
        }
        if ($this->options->accessControl()->hasBlacklistedTraits()) {
            $valid_traits = [];
            foreach ($traits as $trait) {
                $valid_traits[strtolower($trait)] = $trait;
            }
            foreach ($this->options->definitions()->getDefinedTrait() as $name => $value) {
                if (trait_exists($value)) {
                    $valid_traits[strtolower($name)] = $value;
                }
            }
            foreach ($valid_traits as $index => $name) {
                if ($this->options->accessControl()->isBlacklistedTrait($name)) {
                    unset($valid_traits[$index]);
                }
            }
            return array_values($traits);
        }
        $traits = [];
        foreach ($this->options->definitions()->getDefinedTrait() as $value) {
            if (trait_exists($value)) {
                $traits[strtolower($value)] = $value;
            }
        }
        return array_values($traits);
    }

    /** Return get_included_files() and sandboxed included files.
     *
     * @return array Returns array of get_included_files() and sandboxed included files
     */
    public function _get_included_files(): array
    {
        // TODO:暂时禁止了 sandbox 的 include
        //        return array_merge(get_included_files(), $this->includes);
        return array_merge(get_included_files(), []);
    }
}
