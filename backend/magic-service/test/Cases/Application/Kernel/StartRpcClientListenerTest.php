<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Rpc\Listener\StartRpcClientListener;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionMethod;

/**
 * @internal
 */
class StartRpcClientListenerTest extends TestCase
{
    /** @var resource[] */
    private array $socketServers = [];

    /** @var string[] */
    private array $socketPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->socketServers as $server) {
            if (is_resource($server)) {
                fclose($server);
            }
        }
        $this->socketServers = [];

        foreach ($this->socketPaths as $path) {
            @unlink($path);
        }
        $this->socketPaths = [];

        Mockery::close();
    }

    public function testWaitForSocketReadyReturnsTrueWhenSocketIsReady(): void
    {
        $socketPath = $this->createUnixSocketServer();
        $listener = $this->createListener();

        $method = new ReflectionMethod(StartRpcClientListener::class, 'waitForSocketReady');
        $method->setAccessible(true);
        $result = $method->invoke($listener, $socketPath, 1, 50);

        $this->assertTrue($result);
    }

    public function testWaitForSocketReadyReturnsFalseAfterTimeout(): void
    {
        $listener = $this->createListener();
        $path = sys_get_temp_dir() . '/magic-heartbeat-timeout-' . uniqid('', true) . '.sock';
        @unlink($path);

        $method = new ReflectionMethod(StartRpcClientListener::class, 'waitForSocketReady');
        $method->setAccessible(true);
        $result = $method->invoke($listener, $path, 1, 50);

        $this->assertFalse($result);
    }

    private function createListener(): StartRpcClientListener
    {
        $container = Mockery::mock(ContainerInterface::class);
        $config = Mockery::mock(ConfigInterface::class);
        return new StartRpcClientListener($container, $config);
    }

    private function createUnixSocketServer(): string
    {
        $path = sys_get_temp_dir() . '/magic-listener-' . uniqid('', true) . '.sock';
        @unlink($path);

        $server = stream_socket_server(
            'unix://' . $path,
            $errno,
            $errstr,
            STREAM_SERVER_BIND | STREAM_SERVER_LISTEN
        );
        $this->assertNotFalse($server, sprintf('failed to create unix socket server: %s (%d)', $errstr, $errno));

        $this->socketServers[] = $server;
        $this->socketPaths[] = $path;
        return $path;
    }
}
