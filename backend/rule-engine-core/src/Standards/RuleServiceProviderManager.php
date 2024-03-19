<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards;

use Dtyq\RuleEngineCore\Standards\Exception\ConfigurationException;
use Dtyq\RuleEngineCore\Standards\Exception\RuleException;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use Throwable;

abstract class RuleServiceProviderManager
{
    private static array $registrationMap = [];

    public static function registerRuleServiceProvider(string $uri, AbstractRuleServiceProvider|string $provider, ?ContainerInterface $container = null): void
    {
        try {
            switch (gettype($provider)) {
                case 'string':
                    $ref = new ReflectionClass($provider);
                    $rsp = $ref->newInstanceWithoutConstructor();
                    break;
                case 'object':
                    $rsp = $provider;
                    break;
                default:
                    throw new ConfigurationException('Could not register driver against URI: ' . $uri, 1001);
            }

            if (! $rsp instanceof AbstractRuleServiceProvider) {
                throw new RuleException();
            }

            if ($container != null) {
                $rsp->setContainer($container);
            }
            static::$registrationMap[$uri] = $rsp;
        } catch (Throwable $e) {
            throw new ConfigurationException('Could not register driver against URI: ' . $uri, 1001, $e);
        }
    }

    public static function deregisterRuleServiceProvider(string $uri): void
    {
        unset(static::$registrationMap[$uri]);
    }

    public static function getRuleServiceProvider(string $uri): AbstractRuleServiceProvider
    {
        $rsp = static::$registrationMap[$uri] ?? null;
        if ($rsp == null) {
            throw new ConfigurationException('No RuleServiceProvider registered against URI: ' . $uri, 1002);
        }

        return $rsp;
    }
}
