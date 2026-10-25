<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Application\SuperAgent\Service;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleUserMessageAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
final class HandleUserMessageAppServiceTest extends TestCase
{
    public function testMicroAppRequestOverridesPersistedModeAndClearsAgentCode(): void
    {
        $topic = (new TopicEntity())
            ->setTopicMode(ProjectMode::GENERAL->value)
            ->setAgentCode('SMA-persisted');

        $extra = new SuperAgentExtra();
        $extra->setTopicPattern(' micro-app ');
        $extra->setAgentCode('SMA-request');

        $reflection = new ReflectionClass(HandleUserMessageAppService::class);
        $service = $reflection->newInstanceWithoutConstructor();
        $method = $reflection->getMethod('resolveRequestedAgentConfig');
        $method->setAccessible(true);

        $this->assertSame(
            [ProjectMode::MICRO_APP->value, ''],
            $method->invoke($service, $topic, $extra)
        );
    }
}
