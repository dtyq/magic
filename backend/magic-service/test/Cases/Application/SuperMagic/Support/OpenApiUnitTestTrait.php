<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Support;

use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\Connection;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidatorFactory;
use PDO;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use ReflectionProperty;
use RuntimeException;

trait OpenApiUnitTestTrait
{
    private ?ContainerInterface $previousContainer;

    private mixed $previousAuthorization;

    private Config $unitConfig;

    private Connection $unitConnection;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->previousAuthorization = Context::get('magic-user-authorization');
        $basePath = dirname(__DIR__, 5);
        $messages = [
            'file' => require $basePath . '/storage/languages/zh_CN/file.php',
            'task' => require $basePath . '/storage/languages/zh_CN/task.php',
        ];
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('getLocale')->willReturn('zh_CN');
        $translator->method('trans')->willReturnCallback(static function (string $key, array $replace = []) use ($messages): string {
            $parts = explode('.', $key);
            $value = $messages;
            foreach ($parts as $part) {
                $value = is_array($value) ? ($value[$part] ?? null) : null;
            }
            $value = is_string($value) ? $value : $key;
            foreach ($replace as $name => $replacement) {
                $value = str_replace(':' . $name, (string) $replacement, $value);
            }
            return $value;
        });
        $this->unitConfig = new Config([
            'app_env' => 'testing',
            'error_message' => require $basePath . '/config/autoload/error_message.php',
            'super-magic' => ['open_api' => ['file_upload_max_size' => 50 * 1024 * 1024]],
        ]);
        $this->unitConnection = new Connection(new PDO('sqlite::memory:'));
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($this->unitConnection);
        $logger = $this->createMock(LoggerFactory::class);
        $logger->method('get')->willReturn(new NullLogger());
        $id = 1000;
        $ids = $this->createMock(IdGeneratorInterface::class);
        $ids->method('generate')->willReturnCallback(static function () use (&$id): int { return ++$id; });
        $agent = $this->createMock(AgentDomainService::class);
        $agent->method('getAuthorizationByUserId')->willReturn('test-authorization');
        $container = $this->createMock(\Hyperf\Contract\ContainerInterface::class);
        $managers = [];
        foreach ([ThirdPlatformDataIsolationManagerInterface::class, SubscriptionManagerInterface::class, OrganizationInfoManagerInterface::class] as $manager) {
            $managers[$manager] = $this->createMock($manager);
        }
        $container->method('make')->willReturnCallback(static fn (string $name) => $managers[$name]);
        $services = [
            ConfigInterface::class => $this->unitConfig,
            TranslatorInterface::class => $translator,
            ValidatorFactoryInterface::class => new ValidatorFactory($translator),
            LoggerFactory::class => $logger,
            IdGeneratorInterface::class => $ids,
            AgentDomainService::class => $agent,
            ConnectionResolverInterface::class => $resolver,
            Db::class => new Db($container),
            EventDispatcherInterface::class => $this->createMock(EventDispatcherInterface::class),
        ];
        $container->method('has')->willReturnCallback(static fn (string $name): bool => isset($services[$name]));
        $container->method('get')->willReturnCallback(static fn (string $name) => $services[$name] ?? throw new RuntimeException('Unexpected dependency: ' . $name));
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        Context::set('magic-user-authorization', $this->previousAuthorization);
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
        parent::tearDown();
    }

    private function requestWithData(array $data): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn($data);
        $request->method('getAttribute')->willReturn((object) ['params' => []]);
        return $request;
    }

    private function authorization(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())->setId('caller')->setOrganizationCode('caller-org')->setUserType(UserType::Human);
    }

    private function inject(object $object, string $class, array $properties): void
    {
        foreach ($properties as $name => $value) {
            (new ReflectionProperty($class, $name))->setValue($object, $value);
        }
    }
}
