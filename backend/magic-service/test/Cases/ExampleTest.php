<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases;

use Hyperf\Di\Definition\FactoryDefinition;
use Hyperf\Di\Resolver\FactoryResolver;
use Hyperf\Di\Resolver\ResolverDispatcher;
use Hyperf\Support\Reflection\ClassInvoker;
use HyperfTest\HttpTestCase;
use Mockery;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class ExampleTest extends HttpTestCase
{
    public function testExample()
    {
        $res = $this->get('/heartbeat');
        $this->assertEquals(['status' => 'UP'], $res);
    }

    public function testGetDefinitionResolver()
    {
        $container = Mockery::mock(ContainerInterface::class);
        $dispatcher = new ClassInvoker(new ResolverDispatcher($container));
        $resolver = $dispatcher->getDefinitionResolver(Mockery::mock(FactoryDefinition::class));
        $this->assertInstanceOf(FactoryResolver::class, $resolver);
        $this->assertSame($resolver, $dispatcher->factoryResolver);

        $resolver2 = $dispatcher->getDefinitionResolver(Mockery::mock(FactoryDefinition::class));
        $this->assertInstanceOf(FactoryResolver::class, $resolver2);
        $this->assertSame($resolver2, $dispatcher->factoryResolver);
    }
}
