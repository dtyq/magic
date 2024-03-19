<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

use Dtyq\RuleEngineCore\Standards\Admin\RuleAdministratorInterface;
use Psr\Container\ContainerInterface;
use ReflectionClass;

abstract class AbstractRuleServiceProvider
{
    protected static ?ContainerInterface $container = null;

    abstract public function getRuleRuntime(): RuleRuntimeInterface;

    abstract public function getRuleAdministrator(): RuleAdministratorInterface;

    public function setContainer(ContainerInterface $container): void
    {
        static::$container = $container;
    }

    public static function createInstance(string $className): object
    {
        if (is_null(static::$container)) {
            $ref = new ReflectionClass($className);
            $instance = $ref->newInstance();
            return $instance;
        }
        return static::$container->get($className);
    }
}
