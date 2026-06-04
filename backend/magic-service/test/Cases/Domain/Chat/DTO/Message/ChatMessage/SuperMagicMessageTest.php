<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\ChatMessage\SuperMagicMessage;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class SuperMagicMessageTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer(new class implements ContainerInterface {
                public function get(string $id)
                {
                    return match ($id) {
                        PhpSerializerPacker::class => new PhpSerializerPacker(),
                        default => throw new RuntimeException('Unsupported service: ' . $id),
                    };
                }

                public function has(string $id): bool
                {
                    return $id === PhpSerializerPacker::class;
                }
            });
        }
    }

    public function testToArrayIncludesSandboxId(): void
    {
        $message = new SuperMagicMessage([
            'message_id' => 'mock_message_id',
            'task_id' => 'mock_task_id',
            'topic_id' => 'mock_topic_id',
            'sandbox_id' => 'mock_sandbox_id',
            'role' => 'assistant',
            'content' => 'mock content',
        ]);

        $data = $message->toArray();

        $this->assertSame('mock_sandbox_id', $data['sandbox_id']);
        $this->assertSame('mock_task_id', $data['task_id']);
        $this->assertSame('mock_topic_id', $data['topic_id']);
    }
}
