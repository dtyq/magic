<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Support;

use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\MagicChatConversationRepository;
use App\Domain\Chat\Repository\Persistence\MagicChatTopicRepository;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatConversationModel;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatTopicMessageModel;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatTopicModel;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\ContainerInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis as HyperfRedis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Snowflake\Meta;
use Mockery;
use PDO;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use Redis;
use ReflectionClass;
use RuntimeException;

/**
 * Explicitly opt-in disposable MySQL/Redis fixtures. Never loads application .env.
 * @internal
 */
final class ImDefaultTopicMySqlFixture
{
    public const SENDER = '821140649673428993';

    public const RECEIVER = '821140649673428994';

    public static function pdo(int $port, string $database = ''): PDO
    {
        if ($port < 1024 || ! preg_match('/^(im_default_topic_[a-z0-9_]+)?$/', $database)) {
            throw new RuntimeException('Only an explicit disposable test database and high local port are allowed');
        }
        return new PDO('mysql:host=127.0.0.1;port=' . $port . ';charset=utf8mb4' . ($database === '' ? '' : ';dbname=' . $database), 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    public static function schema(PDO $pdo): void
    {
        $pdo->exec('CREATE TABLE magic_chat_conversations (
            id BIGINT UNSIGNED PRIMARY KEY, user_id VARCHAR(128) NOT NULL,
            user_organization_code VARCHAR(128) NOT NULL, receive_id VARCHAR(128) NOT NULL,
            receive_organization_code VARCHAR(128) NOT NULL, receive_type INT NOT NULL,
            is_not_disturb INT DEFAULT 0, is_top INT DEFAULT 0, is_mark INT DEFAULT 0, status INT DEFAULT 1,
            extra LONGTEXT NULL, instructs JSON NULL, translate_config JSON NULL,
            created_at DATETIME NULL, updated_at DATETIME NULL, deleted_at DATETIME NULL,
            UNIQUE KEY unq_user_conversation (user_id,receive_id,receive_type,user_organization_code,receive_organization_code)
        ) ENGINE=InnoDB');
        $pdo->exec('CREATE TABLE magic_chat_topics (
            id BIGINT UNSIGNED PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL,
            topic_id VARCHAR(128) NOT NULL, organization_code VARCHAR(128) NOT NULL,
            name VARCHAR(255) NOT NULL, description TEXT NOT NULL,
            created_at DATETIME NULL, updated_at DATETIME NULL, deleted_at DATETIME NULL,
            KEY idx_conversation_topic (conversation_id,topic_id)
        ) ENGINE=InnoDB');
    }

    public static function seedPair(PDO $pdo, ?string $extra = '{"default_topic_id":"old","unknown":{"kept":true}}'): void
    {
        $insert = $pdo->prepare('INSERT INTO magic_chat_conversations (id,user_id,user_organization_code,receive_id,receive_organization_code,receive_type,extra,created_at,updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())');
        $insert->execute([self::SENDER, 'usi_human', 'org', 'usi_ai', 'org', ConversationType::Ai->value, $extra]);
        $insert->execute([self::RECEIVER, 'usi_ai', 'org', 'usi_human', 'org', ConversationType::User->value, $extra]);
    }

    /** @return array{connection: MySqlConnection, conversations: MagicChatConversationRepository, topics: MagicChatTopicRepository, domain: MagicTopicDomainService, identityDomain: MagicConversationDomainService, redis: Redis} */
    public static function connect(int $port, string $database, int $redisPort): array
    {
        $connection = new class(self::pdo($port, $database), $database, '', ['name' => 'default', 'driver' => 'mysql']) extends MySqlConnection {
            protected int $fetchMode = PDO::FETCH_ASSOC;
        };
        $connection->statement('SET SESSION innodb_lock_wait_timeout=10');
        $redis = new Redis();
        $redis->connect('127.0.0.1', $redisPort);
        $redis->setOption(Redis::OPT_PREFIX, $database . ':');
        $adapter = new class($redis) extends HyperfRedis {
            public function __construct(private Redis $client)
            {
            }

            public function __call($name, $arguments)
            {
                return $this->client->{$name}(...$arguments);
            }
        };
        $container = new class implements ContainerInterface {
            private array $services = [];

            public function get($id)
            {
                return $this->services[$id] ?? throw new RuntimeException('Unconfigured isolated service: ' . $id);
            }

            public function has($id): bool
            {
                return isset($this->services[$id]);
            }

            public function make(string $name, array $parameters = [])
            {
                return $this->get($name);
            }

            public function set(string $name, $entry): void
            {
                $this->services[$name] = $entry;
            }

            public function unbind(string $name): void
            {
                unset($this->services[$name]);
            }

            public function define(string $name, $definition): void
            {
                $this->set($name, $definition);
            }
        };
        $container->set(ConnectionResolverInterface::class, new ConnectionResolver(['default' => $connection]));
        $container->set(Db::class, new Db($container));
        $container->set(PhpSerializerPacker::class, new PhpSerializerPacker());
        $container->set(ConfigInterface::class, new Config(['app_env' => 'testing', 'error_message' => require BASE_PATH . '/config/autoload/error_message.php']));
        $events = new class implements EventDispatcherInterface {
            public array $dispatched = [];

            public function dispatch(object $event): object
            {
                $this->dispatched[] = $event;
                return $event;
            }
        };
        $container->set(EventDispatcherInterface::class, $events);
        $container->set(TranslatorInterface::class, new class implements TranslatorInterface {
            public function trans(string $key, array $replace = [], ?string $locale = null): array|string
            {
                return $key;
            }

            public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
            {
                return $key;
            }

            public function getLocale(): string
            {
                return 'en_US';
            }

            public function setLocale(string $locale): void
            {
            }
        });
        $container->set(IdGeneratorInterface::class, new class implements IdGeneratorInterface {
            private int $next;

            public function __construct()
            {
                $this->next = 850000000000000000 + random_int(1, 1000000000000);
            }

            public function generate(?Meta $meta = null): int
            {
                return ++$this->next;
            }

            public function degenerate(int $id): Meta
            {
                throw new RuntimeException('Not used by the fixture');
            }
        });
        ApplicationContext::setContainer($container);
        $conversations = new MagicChatConversationRepository(new MagicChatConversationModel(), $adapter);
        $topics = new MagicChatTopicRepository(new MagicChatTopicModel(), new MagicChatTopicMessageModel(), $conversations, Mockery::mock(MagicChatSeqRepositoryInterface::class));
        $reflection = new ReflectionClass(MagicTopicDomainService::class);
        $domain = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('magicConversationRepository')->setValue($domain, $conversations);
        $reflection->getProperty('magicChatTopicRepository')->setValue($domain, $topics);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $userRepository->shouldReceive('getUserById')->andReturnUsing(static fn (string $id) => new MagicUserEntity([
            'user_id' => $id, 'magic_id' => $id, 'organization_code' => 'org',
            'user_type' => $id === 'usi_ai' ? UserType::Ai->value : UserType::Human->value,
        ]));
        $accountRepository = Mockery::mock(MagicAccountRepositoryInterface::class);
        $accountRepository->shouldReceive('getAccountInfoByMagicId')->andReturnUsing(static fn (string $id) => new AccountEntity([
            'magic_id' => $id, 'type' => $id === 'usi_ai' ? UserType::Ai->value : UserType::Human->value, 'ai_code' => 'test-ai',
        ]));
        $identityReflection = new ReflectionClass(MagicConversationDomainService::class);
        $identityDomain = $identityReflection->newInstanceWithoutConstructor();
        foreach ([$domain, $identityDomain] as $service) {
            $serviceReflection = new ReflectionClass($service);
            foreach (['magicConversationRepository' => $conversations, 'magicUserRepository' => $userRepository, 'magicAccountRepository' => $accountRepository, 'logger' => new NullLogger()] as $property => $value) {
                $serviceReflection->getProperty($property)->setValue($service, $value);
            }
        }
        return compact('connection', 'conversations', 'topics', 'domain', 'identityDomain', 'redis', 'events');
    }

    public static function clearRedis(Redis $redis, string $database): void
    {
        foreach ($redis->keys('*') as $key) {
            $redis->del(substr($key, strlen($database) + 1));
        }
    }
}
