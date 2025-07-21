<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
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
        $dataIsolation = DataIsolation::create('DT001', 'usi_a450dd07688be6273b5ef112ad50ba7e');
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $userAuthorization->setId($dataIsolation->getCurrentUserId());

        $a = make(AgentAppService::class);
        var_dump($a->getMcpConfig($userAuthorization, $dataIsolation));
        //        $res = $this->get('/heartbeat');
        //        $this->assertEquals(['status' => 'UP'], $res);
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
