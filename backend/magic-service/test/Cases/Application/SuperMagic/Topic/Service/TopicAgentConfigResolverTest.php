<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Topic\Service;

use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class TopicAgentConfigResolverTest extends TestCase
{
    public function testFixedCrewCreatorUsesRequestAgentCode(): void
    {
        $topic = new TopicEntity();
        $topic->setTopicMode('crew-creator');
        $topic->setAgentCode('');
        $extra = new SuperAgentExtra();
        $extra->setAgentCode('SMA-draft-agent');

        $config = (new TopicAgentConfigResolver())->resolve($topic, $extra);

        $this->assertSame('crew-creator', $config->topicMode);
        $this->assertSame('SMA-draft-agent', $config->agentCode);
    }

    public function testFixedCrewCreatorKeepsPersistedAgentCode(): void
    {
        $topic = new TopicEntity();
        $topic->setTopicMode('crew-creator');
        $topic->setAgentCode('SMA-persisted-agent');
        $extra = new SuperAgentExtra();
        $extra->setAgentCode('SMA-request-agent');

        $config = (new TopicAgentConfigResolver())->resolve($topic, $extra);

        $this->assertSame('crew-creator', $config->topicMode);
        $this->assertSame('SMA-persisted-agent', $config->agentCode);
    }

    public function testOtherFixedModeIgnoresRequestAgentCode(): void
    {
        $topic = new TopicEntity();
        $topic->setTopicMode('general');
        $topic->setAgentCode('SMA-persisted-agent');
        $extra = new SuperAgentExtra();
        $extra->setAgentCode('SMA-request-agent');

        $config = (new TopicAgentConfigResolver())->resolve($topic, $extra);

        $this->assertSame('general', $config->topicMode);
        $this->assertSame('SMA-persisted-agent', $config->agentCode);
    }
}
