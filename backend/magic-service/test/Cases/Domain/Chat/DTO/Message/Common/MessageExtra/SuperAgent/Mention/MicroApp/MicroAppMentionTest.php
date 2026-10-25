<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp\MicroAppData;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp\MicroAppMention;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use PHPUnit\Framework\TestCase;

/**
 * @coversNothing
 * @internal
 */
final class MicroAppMentionTest extends TestCase
{
    public function testMicroAppMentionBuildsTypedLinkAndJsonStruct(): void
    {
        $mention = new MicroAppMention([
            'type' => 'mention',
            'attrs' => [
                'type' => 'micro_app',
                'data' => [
                    'app_id' => '42',
                    'app_name' => 'Demo App',
                    'icon' => 'https://example.com/icon.png',
                ],
            ],
        ]);

        $this->assertSame(
            '[Demo App](micro-app://42)',
            $mention->getMentionTextStruct()
        );

        $json = $mention->getMentionJsonStruct();
        $this->assertSame('micro_app', $json['type']);
        $this->assertSame('42', $json['app_id']);
        $this->assertSame('Demo App', $json['app_name']);
        $this->assertInstanceOf(MicroAppData::class, $mention->getAttrs()->getData());

        $assembled = MentionAssembler::fromArray([
            'type' => 'mention',
            'attrs' => [
                'type' => 'micro_app',
                'data' => [
                    'app_id' => '42',
                    'app_name' => 'Demo App',
                ],
            ],
        ]);
        $this->assertInstanceOf(MicroAppMention::class, $assembled);
    }
}
