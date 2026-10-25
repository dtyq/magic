<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Application\SuperMagic\Message\Service\MessageScheduleAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/** @internal */
final class MessageScheduleTopicCreationTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $container = $this->createMock(ContainerInterface::class);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('testing');
        $services = [PhpSerializerPacker::class => new PhpSerializerPacker(), ConfigInterface::class => $config];
        $container->method('get')->willReturnCallback(static fn ($id) => $services[$id]);
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testSummaryPrecedesConversationUpdateAndTopicMetadataIsPreserved(): void
    {
        $events = [];
        $chatMessages = $this->createMock(MagicChatMessageAppService::class);
        $chatMessages->expects(self::once())->method('summarizeText')->willReturnCallback(function ($authorization, string $content) use (&$events): string {
            self::assertSame('hello', $content);
            $events[] = 'summary';
            return 'title';
        });
        $chat = $this->createMock(ChatAppService::class);
        $chat->expects(self::once())->method('createMagicChatTopicForConversationPair')->willReturnCallback(function () use (&$events): array {
            $events[] = 'conversation';
            return ['chat_conversation_id' => 'conversation-id', 'receive_conversation_id' => 'receive-id', 'chat_topic_id' => 'chat-topic-id'];
        });
        $topic = new TopicEntity(['id' => 42]);
        $topics = $this->createMock(TopicDomainService::class);
        $topics->expects(self::once())->method('createTopic')->willReturnCallback(function ($isolation, $workspace, $project, $conversation, $chatTopic, $title, $workDir, $mode, $source, $sourceId) use ($topic, &$events): TopicEntity {
            self::assertSame(7, $project);
            self::assertSame('conversation-id', $conversation);
            self::assertSame('chat-topic-id', $chatTopic);
            self::assertMatchesRegularExpression('/^title [0-9]{10}$/', $title);
            self::assertSame('execution-log', $sourceId);
            $events[] = 'topic';
            return $topic;
        });
        $files = $this->createMock(TaskFileDomainService::class);
        $files->expects(self::once())->method('findOrCreateTopicRootDirectory')->willReturn(11);
        self::assertSame($topic, $this->invoke($this->service($chatMessages, $chat, $topics, $files)));
        self::assertSame(['summary', 'conversation', 'topic'], $events);
    }

    public function testSummaryFailureStopsBeforeImInitializationAndRethrowsTheSameException(): void
    {
        $error = new RuntimeException('summary failed');
        $chatMessages = $this->createMock(MagicChatMessageAppService::class);
        $chatMessages->expects(self::once())->method('summarizeText')->willThrowException($error);
        $chat = $this->createMock(ChatAppService::class);
        $chat->expects(self::never())->method('createMagicChatTopicForConversationPair');
        $topics = $this->createMock(TopicDomainService::class);
        $topics->expects(self::never())->method('createTopic');
        $files = $this->createMock(TaskFileDomainService::class);
        $files->expects(self::never())->method('findOrCreateTopicRootDirectory');
        try {
            $this->invoke($this->service($chatMessages, $chat, $topics, $files));
            self::fail('Expected summary failure');
        } catch (RuntimeException $exception) {
            self::assertSame($error, $exception);
        }
    }

    public function testExistingTopicSkipsSummaryAndConversationInitialization(): void
    {
        $chatMessages = $this->createMock(MagicChatMessageAppService::class);
        $chatMessages->expects(self::never())->method('summarizeText');
        $chat = $this->createMock(ChatAppService::class);
        $chat->expects(self::never())->method('createMagicChatTopicForConversationPair');
        $topics = $this->createMock(TopicDomainService::class);
        $topic = new TopicEntity(['id' => 42]);
        $topics->expects(self::once())->method('getTopicById')->with(42)->willReturn($topic);
        self::assertSame($topic, $this->invoke($this->service($chatMessages, $chat, $topics, $this->createMock(TaskFileDomainService::class)), 42));
    }

    private function service(MagicChatMessageAppService $messages, ChatAppService $chat, TopicDomainService $topics, TaskFileDomainService $files): MessageScheduleAppService
    {
        $reflection = new ReflectionClass(MessageScheduleAppService::class);
        $service = $reflection->newInstanceWithoutConstructor();
        foreach (['chatMessageAppService' => $messages, 'chatAppService' => $chat, 'topicDomainService' => $topics, 'taskFileDomainService' => $files] as $name => $value) {
            $reflection->getProperty($name)->setValue($service, $value);
        }
        return $service;
    }

    private function invoke(MessageScheduleAppService $service, int $topicId = 0): ?TopicEntity
    {
        $isolation = $this->createMock(DataIsolation::class);
        $isolation->method('getCurrentUserId')->willReturn('user');
        $isolation->method('getCurrentOrganizationCode')->willReturn('org');
        return (new ReflectionMethod($service, 'getTopicOrCreate'))->invoke(
            $service,
            $isolation,
            $topicId,
            new ProjectEntity(['id' => 7, 'workspace_id' => 1]),
            'text',
            ['content' => 'hello'],
            'execution-log'
        );
    }
}
