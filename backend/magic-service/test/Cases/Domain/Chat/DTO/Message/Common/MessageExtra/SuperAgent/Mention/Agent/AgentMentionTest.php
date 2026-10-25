<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent\AgentData;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent\AgentMention;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use PHPUnit\Framework\TestCase;

/**
 * @coversNothing
 * @internal
 */
final class AgentMentionTest extends TestCase
{
    public function testAgentMentionKeepsBusinessIdAndOptionalRuntimeCodeSeparate(): void
    {
        $mention = new AgentMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'agent',
                'data' => [
                    'agent_id' => 'business-agent-123',
                    'agent_code' => 'SMA-slide-expert',
                    'agent_name' => '幻灯片专家',
                    'agent_description' => '制作幻灯片',
                ],
            ],
        ]);

        $this->assertSame(
            '[幻灯片专家](agent://business-agent-123)',
            $mention->getMentionTextStruct()
        );

        $json = $mention->getMentionJsonStruct();
        $this->assertSame('business-agent-123', $json['agent_id']);
        $this->assertSame('SMA-slide-expert', $json['agent_code']);
        $this->assertInstanceOf(AgentData::class, $mention->getAttrs()->getData());

        $assembled = MentionAssembler::fromArray([
            'type' => 'mention',
            'attrs' => [
                'type' => 'agent',
                'data' => [
                    'agent_id' => 'business-agent-123',
                    'agent_code' => 'SMA-slide-expert',
                    'agent_name' => '幻灯片专家',
                ],
            ],
        ]);
        $this->assertInstanceOf(AgentMention::class, $assembled);
    }
}
