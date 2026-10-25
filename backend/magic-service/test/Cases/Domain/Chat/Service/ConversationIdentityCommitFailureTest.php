<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\Service;

use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\TransactionCommitOutcomeUnknownException;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Connection;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use RuntimeException;

/** @internal */
final class ConversationIdentityCommitFailureTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    #[DataProvider('reconnectOutcomes')]
    public function testRollbackFailureReconnectsThePooledWrapperAndPreservesCommitError(bool $reconnectFails): void
    {
        $commitError = new RuntimeException('commit response lost');
        $connection = $this->createMock(Connection::class);
        $connection->method('transactionLevel')->willReturn(0);
        $connection->expects(self::once())->method('beginTransaction');
        $connection->expects(self::once())->method('commit')->willThrowException($commitError);
        $connection->expects(self::once())->method('rollBack')->willThrowException(new RuntimeException('rollback disconnected'));
        $connection->expects(self::never())->method('close');
        $reconnect = $connection->expects(self::once())->method('reconnect');
        if ($reconnectFails) {
            $reconnect->willThrowException(new RuntimeException('reconnect failed'));
        } else {
            $reconnect->willReturn(true);
        }
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $container = $this->createMock(ContainerInterface::class);
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('testing');
        $services = [
            ConnectionResolverInterface::class => $resolver,
            ConfigInterface::class => $config,
            PhpSerializerPacker::class => new PhpSerializerPacker(),
            Db::class => new Db($container),
        ];
        $container->method('get')->willReturnCallback(static fn ($id) => $services[$id]);
        ApplicationContext::setContainer($container);
        $service = $this->getMockBuilder(MagicConversationDomainService::class)->disableOriginalConstructor()
            ->onlyMethods(['parsePrivateChatConversationReceiveType'])->getMock();
        $service->method('parsePrivateChatConversationReceiveType')->willReturnCallback(static function (MagicConversationEntity $identity): MagicConversationEntity {
            $identity->setUserOrganizationCode('org');
            $identity->setReceiveOrganizationCode('org');
            $identity->setReceiveType($identity->getReceiveId() === 'ai' ? ConversationType::Ai : ConversationType::User);
            return $identity;
        });
        $repository = $this->createMock(MagicChatConversationRepositoryInterface::class);
        $repository->expects(self::exactly(2))->method('getConversationByIdentity')->willReturnCallback(static function (MagicConversationEntity $identity): MagicConversationEntity {
            $identity->setId($identity->getUserId() === 'human' ? '1' : '2');
            return $identity;
        });
        $repository->expects(self::never())->method('addConversation');
        $reflection = new ReflectionClass(MagicConversationDomainService::class);
        $reflection->getProperty('magicConversationRepository')->setValue($service, $repository);
        $reflection->getProperty('logger')->setValue($service, new NullLogger());
        $isolation = $this->createMock(DataIsolation::class);
        $isolation->method('getCurrentUserId')->willReturn('human');
        $isolation->method('getCurrentOrganizationCode')->willReturn('org');
        try {
            $service->getOrCreateConversationPair($isolation, 'ai');
            self::fail('Expected unknown commit outcome');
        } catch (TransactionCommitOutcomeUnknownException $exception) {
            self::assertSame($commitError, $exception->getPrevious());
        }
    }

    public static function reconnectOutcomes(): array
    {
        return [[false], [true]];
    }
}
