<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
final class AbstractAppServiceTest extends TestCase
{
    public function testCreatesModelGatewayDataIsolationFromContactDataIsolation(): void
    {
        $contactDataIsolation = DataIsolation::create('ORG001', 'user-1');
        $contactDataIsolation->setCurrentMagicId('magic-1');

        $service = new class extends AbstractAppService {};
        $reflection = new ReflectionClass($service);
        $method = $reflection->getMethod('createModelGatewayDataIsolationFromContactDataIsolation');
        $method->setAccessible(true);

        $modelGatewayDataIsolation = $method->invoke($service, $contactDataIsolation);

        $this->assertInstanceOf(ModelGatewayDataIsolation::class, $modelGatewayDataIsolation);
        $this->assertSame('ORG001', $modelGatewayDataIsolation->getCurrentOrganizationCode());
        $this->assertSame('user-1', $modelGatewayDataIsolation->getCurrentUserId());
        $this->assertSame('magic-1', $modelGatewayDataIsolation->getMagicId());
    }
}
