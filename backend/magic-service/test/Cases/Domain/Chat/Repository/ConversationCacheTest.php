<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\Repository;

use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Repository\Persistence\MagicChatConversationRepository;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatConversationModel;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;

/** @internal */
final class ConversationCacheTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private ?ConnectionResolverInterface $previousResolver;

    private MySqlConnection $connection;

    private Redis $redis;

    private MagicChatConversationRepository $repository;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->previousResolver = Register::getConnectionResolver();
        $this->connection = $this->getMockBuilder(MySqlConnection::class)
            ->setConstructorArgs([$this->createMock(PDO::class), 'unit_test'])
            ->onlyMethods(['select', 'transactionLevel', 'update'])->getMock();
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($this->connection);
        Register::setConnectionResolver($resolver);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key) => $key === 'error_message'
            ? ['error_code_mapper' => [GenericErrorCode::class => [0, 99999]]] : 'testing');
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $container = $this->createMock(ContainerInterface::class);
        $services = [
            ConnectionResolverInterface::class => $resolver,
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            PhpSerializerPacker::class => new PhpSerializerPacker(),
            Db::class => new Db($container),
            EventDispatcherInterface::class => $this->createMock(EventDispatcherInterface::class),
        ];
        $container->method('get')->willReturnCallback(static fn ($id) => $services[$id]);
        ApplicationContext::setContainer($container);
        $this->redis = $this->getMockBuilder(Redis::class)->disableOriginalConstructor()->addMethods(['get', 'setex', 'del'])->getMock();
        $this->repository = new MagicChatConversationRepository(new MagicChatConversationModel(), $this->redis);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
        if ($this->previousResolver !== null) {
            Register::setConnectionResolver($this->previousResolver);
        } else {
            Register::unsetConnectionResolver();
        }
    }

    public function testCachedIdReadsFreshMatchingRow(): void
    {
        $this->connection->method('transactionLevel')->willReturn(0);
        $this->redis->expects(self::once())->method('get')->with(self::stringStartsWith('conversation_identity_v2:'))->willReturn('42');
        $this->redis->expects(self::never())->method('setex');
        $this->connection->expects(self::once())->method('select')->willReturnCallback(function ($sql, $bindings): array {
            self::assertStringContainsString('`deleted_at` is null', $sql);
            self::assertSame(['42', 'human', 'ai', ConversationType::Ai->value, 'org', 'org'], $bindings);
            return [$this->row('42', '{"default_topic_id":"new"}')];
        });
        self::assertSame('new', $this->repository->getConversationByUserIdAndReceiveId($this->identity())->getExtra()->getDefaultTopicId());
    }

    public function testStaleIdIsEvictedAndCacheStoresOnlyReplacementId(): void
    {
        $this->connection->method('transactionLevel')->willReturn(0);
        $this->redis->expects(self::once())->method('get')->willReturn('deleted');
        $this->redis->expects(self::once())->method('del')->with(self::stringStartsWith('conversation_identity_v2:'));
        $this->redis->expects(self::once())->method('setex')->with(self::stringStartsWith('conversation_identity_v2:'), 60, '43');
        $this->connection->expects(self::exactly(2))->method('select')->willReturnOnConsecutiveCalls([], [$this->row('43')]);
        self::assertSame('43', $this->repository->getConversationByUserIdAndReceiveId($this->identity())->getId());
    }

    public function testTransactionNeverReadsOrPublishesSharedCache(): void
    {
        $this->connection->method('transactionLevel')->willReturn(1);
        $this->redis->expects(self::never())->method('get');
        $this->redis->expects(self::never())->method('setex');
        $this->redis->expects(self::never())->method('del');
        $this->connection->expects(self::once())->method('select')->willReturn([$this->row('44')]);
        self::assertSame('44', $this->repository->getConversationByUserIdAndReceiveId($this->identity())->getId());
    }

    public function testOptionalTypeAndOrganizationSelectorsHaveDifferentKeysAndSql(): void
    {
        $this->connection->method('transactionLevel')->willReturn(0);
        $keys = [];
        $bindings = [];
        $this->redis->method('get')->willReturnCallback(static function ($key) use (&$keys): false {
            $keys[] = $key;
            return false;
        });
        $this->connection->method('select')->willReturnCallback(static function ($sql, $values) use (&$bindings): array {
            $bindings[] = $values;
            return [];
        });
        $this->redis->expects(self::never())->method('setex');
        $unscoped = new MagicConversationEntity(['user_id' => 'human', 'receive_id' => 'ai']);
        $typed = clone $unscoped;
        $typed->setReceiveType(ConversationType::Ai);
        $userScoped = clone $typed;
        $userScoped->setUserOrganizationCode('org');
        foreach ([$unscoped, $typed, $userScoped, $this->identity()] as $identity) {
            self::assertNull($this->repository->getConversationByUserIdAndReceiveId($identity));
        }
        self::assertCount(4, array_unique($keys));
        self::assertSame([['human', 'ai'], ['human', 'ai', ConversationType::Ai->value], ['human', 'ai', ConversationType::Ai->value, 'org'], ['human', 'ai', ConversationType::Ai->value, 'org', 'org']], $bindings);
    }

    public function testAuthoritativeIdentityAlwaysUsesTheCompleteTupleAndBypassesCache(): void
    {
        $identity = $this->identity();
        $identity->setUserOrganizationCode('0');
        $this->redis->expects(self::never())->method('get');
        $this->redis->expects(self::never())->method('setex');
        $this->connection->expects(self::once())->method('select')->willReturnCallback(static function ($sql, $bindings): array {
            self::assertStringNotContainsString('deleted_at', $sql);
            self::assertSame(['human', 'ai', ConversationType::Ai->value, '0', 'org'], $bindings);
            return [];
        });
        self::assertNull($this->repository->getConversationByIdentity($identity, true));
    }

    public function testDefaultMergePreservesUnknownObjectsAndArrays(): void
    {
        $this->connection->method('transactionLevel')->willReturn(1);
        $this->connection->method('select')->willReturn([$this->row('42', '{"default_topic_id":"old","nested":{"empty":{}},"list":[1,true]}')]);
        $this->connection->expects(self::once())->method('update')->willReturnCallback(static function ($sql, $bindings): int {
            self::assertSame('{"default_topic_id":"9223372036854775807","nested":{"empty":{}},"list":[1,true]}', $bindings[0]);
            return 1;
        });
        $this->repository->updateDefaultTopicId('42', '9223372036854775807');
    }

    #[DataProvider('invalidExtra')]
    public function testNonObjectExtraFailsWithoutUpdate(string $extra): void
    {
        $this->connection->method('transactionLevel')->willReturn(1);
        $this->connection->method('select')->willReturn([$this->row('42', $extra)]);
        $this->connection->expects(self::never())->method('update');
        $this->expectException(BusinessException::class);
        $this->repository->updateDefaultTopicId('42', '100');
    }

    public static function invalidExtra(): array
    {
        return [['[]'], ['null'], ['true'], ['123'], ['"text"'], ['{broken']];
    }

    #[DataProvider('emptyExtra')]
    public function testEmptyExtraIsInitializedAsObject(?string $extra): void
    {
        $this->connection->method('transactionLevel')->willReturn(1);
        $this->connection->method('select')->willReturn([$this->row('42', $extra)]);
        $this->connection->expects(self::once())->method('update')->willReturnCallback(static function ($sql, $bindings): int {
            self::assertSame('{"default_topic_id":"100"}', $bindings[0]);
            return 1;
        });
        $this->repository->updateDefaultTopicId('42', '100');
    }

    public static function emptyExtra(): array
    {
        return [[null], [''], ['{}']];
    }

    public function testLocksUseNumericStringOrderWithoutPrecisionLoss(): void
    {
        $this->connection->method('transactionLevel')->willReturn(1);
        $seen = [];
        $this->connection->method('select')->willReturnCallback(function ($sql, $bindings) use (&$seen): array {
            self::assertStringContainsString('for update', $sql);
            $seen[] = $bindings[0];
            return [$this->row($bindings[0])];
        });
        $this->repository->getConversationsByIdsForUpdate(['9223372036854775807', '10', '9', '9223372036854775806']);
        self::assertSame(['9', '10', '9223372036854775806', '9223372036854775807'], $seen);
    }

    private function identity(): MagicConversationEntity
    {
        return new MagicConversationEntity(['user_id' => 'human', 'receive_id' => 'ai', 'receive_type' => ConversationType::Ai->value, 'user_organization_code' => 'org', 'receive_organization_code' => 'org']);
    }

    private function row(string $id, ?string $extra = ''): array
    {
        return ['id' => $id, 'user_id' => 'human', 'receive_id' => 'ai', 'receive_type' => ConversationType::Ai->value, 'user_organization_code' => 'org', 'receive_organization_code' => 'org', 'extra' => $extra];
    }
}
