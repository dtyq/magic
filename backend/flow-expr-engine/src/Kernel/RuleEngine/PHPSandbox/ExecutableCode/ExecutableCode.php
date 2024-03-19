<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode;

use Dtyq\FlowExprEngine\ComponentContext;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;
use ReflectionFunction;
use ReflectionNamedType;
use ReflectionUnionType;

class ExecutableCode
{
    public static array $methods = [];

    public static array $constants = [];

    /**
     * @return array<MethodInterface>
     */
    public static function getMethods(): array
    {
        return self::$methods;
    }

    /**
     * @return array<string>
     */
    public static function getConstants(): array
    {
        return self::$constants;
    }

    public static function registerMethods(): void
    {
        $functions = ComponentContext::getSdkContainer()->getConfig()->get('flow_expr_engine.php_sandbox_functions', []);

        $methods = [];
        foreach ($functions as $function => $options) {
            if ($options instanceof MethodInterface) {
                $methods[] = $options;
            }
            if (is_string($options) && class_exists($options)) {
                $method = new $options();
                if ($method instanceof MethodInterface) {
                    $methods[] = $method;
                }
            }
            // 独立函数配置
            if (is_string($function) && is_array($options)) {
                $methods[] = self::createMethodByArrayOptions($function, $options);
            }
            // 仅函数
            if (is_int($function) && is_string($options) && function_exists($options)) {
                $methods[] = self::createMethodByStringFunction($options);
            }

            // 分组形式
            if (is_int($function) && is_array($options)) {
                $methods = array_merge($methods, self::createMethodByGroupOptions($options));
            }
        }
        foreach ($methods as $method) {
            self::registerMethod($method);
        }
        // 对 methods 排序
        ksort(self::$methods);
    }

    public static function registerConstant(): void
    {
        $constants = ComponentContext::getSdkContainer()->getConfig()->get('flow_expr_engine.php_sandbox_constants', []);
        foreach ($constants as $constant) {
            $constant = "{$constant}";
            if (defined($constant)) {
                self::$constants[] = "{$constant}";
            }
        }
    }

    private static function registerMethod(MethodInterface $method): void
    {
        $method->validate();
        if ($method instanceof AbstractMethod && $method->getGroup() === 'hide') {
            $method->setHide(true);
        }
        self::$methods[$method->getCode()] = $method;
    }

    private static function createMethodByArrayOptions(string $code, array $options): MethodInterface
    {
        $method = new class extends AbstractMethod {};
        $method->setCode($code);
        $method->setName($options['name'] ?? '');
        $method->setReturnType($options['return_type'] ?? '');
        $method->setGroup($options['group'] ?? '');
        $method->setDesc($options['desc'] ?? '');
        $method->setArgs($options['args'] ?? []);
        $method->setFunction($options['function'] ?? null);
        return $method;
    }

    private static function createMethodByStringFunction(string $code): MethodInterface
    {
        $method = new class extends AbstractMethod {};
        $method->setCode($code);
        $reflectionFunction = new ReflectionFunction($code);
        $method->setName($reflectionFunction->getName());

        $args = [];
        foreach ($reflectionFunction->getParameters() as $parameter) {
            $arg = [
                'name' => $parameter->getName(),
                'desc' => '',
            ];
            if ($parameter->getType() instanceof ReflectionNamedType) {
                $arg['type'] = $parameter->getType()->getName();
            }
            if ($parameter->getType() instanceof ReflectionUnionType) {
                $argType = [];
                foreach ($parameter->getType()->getTypes() as $type) {
                    $argType[] = $type->getName();
                }
                $arg['type'] = implode('|', $argType);
            }
            $args[] = $arg;
        }
        $method->setArgs($args);

        $returnType = 'mixed';
        if ($reflectionFunction->getReturnType() instanceof ReflectionNamedType) {
            $returnType = $reflectionFunction->getReturnType()->getName();
        }
        if ($reflectionFunction->getReturnType() instanceof ReflectionUnionType) {
            $returnType = [];
            foreach ($reflectionFunction->getReturnType()->getTypes() as $type) {
                $returnType[] = $type->getName();
            }
            $returnType = implode('|', $returnType);
        }

        $method->setReturnType($returnType);
        $method->setGroup('内置函数');

        return $method;
    }

    private static function createMethodByGroupOptions(array $options): array
    {
        $group = $options['group'] ?? '';
        $functions = $options['functions'] ?? [];
        if (empty($group) || empty($functions)) {
            return [];
        }
        $methods = [];
        foreach ($functions as $function => $options) {
            if ($options instanceof MethodInterface) {
                $methods[] = $options;
            }
            if (is_string($options) && class_exists($options)) {
                $method = new $options();
                if ($method instanceof MethodInterface) {
                    $methods[] = $method;
                }
            }
            // 独立函数配置
            if (is_string($function) && is_array($options)) {
                /** @var AbstractMethod $method */
                $method = self::createMethodByArrayOptions($function, $options);
                $method->setGroup($group);
                $methods[] = $method;
            }
            // 仅函数
            if (is_int($function) && is_string($options) && function_exists($options)) {
                $method = self::createMethodByStringFunction($options);
                $method->setGroup($group);
                $methods[] = $method;
            }
        }
        return $methods;
    }
}
