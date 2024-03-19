<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase\Tests;

use Dtyq\SdkBase\Kernel\Component\Client\ClientRequest;
use Dtyq\SdkBase\Kernel\Component\Config\Config;
use Dtyq\SdkBase\Kernel\Component\Exception\ExceptionBuilder;
use Dtyq\SdkBase\Kernel\Component\Logger\LoggerProxy;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;
use Dtyq\SdkBase\SdkBase;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

/**
 * @internal
 * @coversNothing
 */
class SdkBaseTest extends TestCase
{
    public function testCreate()
    {
        $sdkBase = $this->createSdkBase();

        $this->assertInstanceOf(SdkBase::class, $sdkBase);
        $this->assertInstanceOf(Config::class, $sdkBase->getConfig());
        $this->assertInstanceOf(ExceptionBuilder::class, $sdkBase->getExceptionBuilder());
        $this->assertInstanceOf(LoggerProxy::class, $sdkBase->getLogger());
        $this->assertInstanceOf(ClientInterface::class, $sdkBase->getClient());
        $this->assertInstanceOf(ClientRequest::class, $sdkBase->getClientRequest());
        $this->assertInstanceOf(CacheInterface::class, $sdkBase->getCache());
    }

    public function testConfig()
    {
        $sdkBase = $this->createSdkBase();
        $this->assertEquals('xxx', $sdkBase->getConfig()->getSdkName());
    }

    public function testGetExceptionBuilder()
    {
        $sdkBase = $this->createSdkBase();
        $this->assertInstanceOf(ExceptionBuilder::class, $sdkBase->getExceptionBuilder());
        try {
            $sdkBase->getExceptionBuilder()->throw(500, 'test');
        } catch (Throwable $throwable) {
            $this->assertInstanceOf(BusinessException::class, $throwable);
            $this->assertEquals(500, $throwable->getCode());
            $this->assertEquals('test', $throwable->getMessage());
        }
    }

    public function testLogger()
    {
        $sdkBase = $this->createSdkBase();
        $logger = $sdkBase->getLogger();
        $this->assertInstanceOf(LoggerProxy::class, $logger);
        $logger->info('test', ['ooo' => 'xxx']);

        $this->expectOutputString('info [xxx] test {"ooo":"xxx"}' . PHP_EOL);
    }

    public function testClient()
    {
        $sdkBase = $this->createSdkBase();
        $client = $sdkBase->getClient();
        $this->assertInstanceOf(ClientInterface::class, $client);
    }

    public function testClientSendRequest()
    {
        $configs = [
            'sdk_name' => 'xxx',
            'exception_class' => BusinessException::class,
        ];
        $container = new Container();
        [$client, $request] = $this->createMockClient();
        $container->set(ClientInterface::class, $client);
        $sdkBase = new SdkBase($container, $configs);
        $response = $sdkBase->getClientRequest()->sendRequest($request);
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('{"code": 0, "message": "success"}', $response->getBody()->getContents());
    }

    public function testClientRequest()
    {
        $this->markTestSkipped('真实请求');
        $sdkBase = $this->createSdkBase();
        $response = $sdkBase->getClientRequest()->request(RequestMethod::Get, 'https://www.baidu.com');
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testCache()
    {
        $sdkBase = $this->createSdkBase();
        $cache = $sdkBase->getCache();
        if ($cache->set('test', 'xxx')) {
            $this->assertEquals('xxx', $cache->get('test', 'xxx'));
        }
    }

    private function createMockClient(): array
    {
        $request = new Request(
            method: 'POST',
            uri: 'https://mock.xyz/api/v1/user',
            headers: [
                'organization-code' => 'xxx',
                'token' => 'mock_token',
            ],
            body: json_encode(['user_ids' => [1]]),
        );
        $client = Mockery::mock(Client::class);
        $client->allows()->sendRequest($request)->andReturn(new Response(200, [], '{"code": 0, "message": "success"}'));

        return [$client, $request];
    }

    private function createSdkBase(): SdkBase
    {
        $configs = [
            'sdk_name' => 'xxx',
            'exception_class' => BusinessException::class,
        ];
        $container = new Container();
        return new SdkBase($container, $configs);
    }
}
