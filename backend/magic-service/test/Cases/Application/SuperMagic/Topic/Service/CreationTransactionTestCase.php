<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Topic\Service;

use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Snowflake\IdGeneratorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionProperty;
use RuntimeException;

/**
 * Tests application ordering and rollback decisions; database locking is covered by integration tests.
 * @internal
 */
abstract class CreationTransactionTestCase extends TestCase
{
    protected array $events = [];

    protected int $transactionLevel = 0;

    protected array $services = [];

    protected array $pair = ['sender_conversation_id' => '11', 'receiver_conversation_id' => '12'];

    protected array $pendingDefault = ['chat_conversation_id' => '11', 'receive_conversation_id' => '12', 'chat_topic_id' => '99'];

    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $container = $this->createMock(ContainerInterface::class);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => match ($key) {
            'app_env' => 'testing',
            'error_message' => ['error_code_mapper' => [SuperAgentErrorCode::class => [0, PHP_INT_MAX]]],
            default => $default,
        });
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->method('beginTransaction')->willReturnCallback(function (): void {
            self::assertSame(0, $this->transactionLevel);
            ++$this->transactionLevel;
            $this->events[] = 'begin';
        });
        $connection->method('commit')->willReturnCallback(function (): void {
            self::assertSame(1, $this->transactionLevel);
            --$this->transactionLevel;
            $this->events[] = 'commit';
        });
        $connection->method('rollBack')->willReturnCallback(function (): void {
            self::assertSame(1, $this->transactionLevel, 'Only the transaction opened by this owner may roll back');
            --$this->transactionLevel;
            $this->events[] = 'rollback';
        });
        $connection->method('transactionLevel')->willReturnCallback(fn () => $this->transactionLevel);
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $idGenerator = $this->createMock(IdGeneratorInterface::class);
        $idGenerator->method('generate')->willReturn(123);
        $this->services = [
            IdGeneratorInterface::class => $idGenerator,
            AgentDomainService::class => $this->createMock(AgentDomainService::class),
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            PhpSerializerPacker::class => new PhpSerializerPacker(),
            ConnectionResolverInterface::class => $resolver,
            Db::class => new Db($container),
        ];
        $container->method('get')->willReturnCallback(fn ($id) => $this->services[$id] ?? throw new RuntimeException('Unexpected dependency: ' . $id));
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
        }
    }

    protected function chat(?string $failure = null): ChatAppService
    {
        $chat = $this->createMock(ChatAppService::class);
        $chat->method('getOrCreateMagicChatConversationPair')->willReturnCallback(function () use ($failure): array {
            $this->events[] = 'identity';
            if ($failure === 'identity' || $this->transactionLevel !== 0) {
                throw new RuntimeException('Identity requires no outer transaction');
            }
            return $this->pair;
        });
        $chat->method('createMagicChatTopicForConversationPair')->willReturnCallback(function ($isolation, array $pair): array {
            self::assertSame($this->pair, $pair);
            self::assertSame(1, $this->transactionLevel);
            $this->events[] = 'im-topic';
            return $this->pendingDefault;
        });
        $chat->method('setMagicChatDefaultTopic')->willReturnCallback(function (array $context) use ($failure): void {
            self::assertSame($this->pendingDefault, $context);
            self::assertSame(1, $this->transactionLevel);
            $this->events[] = 'default';
            if ($failure === 'default') {
                throw new RuntimeException('Default update failed');
            }
        });
        return $chat;
    }

    protected function authorization(): MagicUserAuthorization
    {
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $authorization->method('getUserType')->willReturn(UserType::Human);
        $authorization->method('getId')->willReturn('user');
        $authorization->method('getOrganizationCode')->willReturn('org');
        return $authorization;
    }

    protected function requestContext(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($this->authorization());
        return $context;
    }

    protected function project(): ProjectEntity
    {
        return new ProjectEntity(['id' => 7, 'workspace_id' => 1, 'user_id' => 'user', 'user_organization_code' => 'org', 'work_dir' => '/project_7/workspace']);
    }

    protected function topic(): TopicEntity
    {
        return new TopicEntity(['id' => 42, 'project_id' => 7, 'workspace_id' => 1, 'user_id' => 'user', 'chat_conversation_id' => '11', 'chat_topic_id' => '99', 'current_task_status' => 'waiting', 'updated_at' => '2026-10-10 10:00:00']);
    }

    protected function inject(object $service, array $dependencies): void
    {
        $reflection = new ReflectionClass($service);
        foreach ($dependencies + ['logger' => new NullLogger()] as $name => $value) {
            $reflection->getProperty($name)->setValue($service, $value);
        }
    }
}
