<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VolcengineArk\Assets;

use App\Infrastructure\ExternalAPI\VolcengineArk\Assets\VolcengineArkAssetsClient;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\RequestInterface;
use Psr\Log\AbstractLogger;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * @internal
 */
final class VolcengineArkAssetsClientTest extends TestCase
{
    /** @var array<int, RequestInterface> 记录用例实际发出的请求，供断言签名与请求体。 */
    private array $requests = [];

    public function testMissingCredentialsAreRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('素材服务配置不完整，请联系管理员');
        (new VolcengineArkAssetsClient($this->createMock(ClientFactory::class), new NullLogger(), ['secret_key' => 'sk']))->request('GetAsset', []);
    }

    public function testUnsupportedActionIsRejectedBeforeHttp(): void
    {
        $factory = $this->createMock(ClientFactory::class);
        $factory->expects(self::never())->method('create');
        $client = $this->createClient($factory, $this->config());
        $this->expectExceptionMessage('当前素材操作暂不支持，请联系管理员');
        $client->request('UnknownAction', []);
    }

    public function testSignedRequestAndOriginalResponse(): void
    {
        $expected = ['ResponseMetadata' => ['RequestId' => 'req-1'], 'Result' => ['Id' => 'group-1']];
        $client = $this->createClient($this->factory($expected), $this->config());
        $response = $client->request('CreateAssetGroup', ['Name' => '联调组', 'GroupType' => 'AIGC']);
        self::assertSame($expected, $response);
        $request = $this->requests[0];
        self::assertSame('/?Action=CreateAssetGroup&Version=2024-01-01', (string) $request->getUri()->getPath() . '?' . $request->getUri()->getQuery());
        self::assertSame(hash('sha256', (string) $request->getBody()), $request->getHeaderLine('X-Content-Sha256'));
        self::assertMatchesRegularExpression('/^\d{8}T\d{6}Z$/', $request->getHeaderLine('X-Date'));
        self::assertStringStartsWith('HMAC-SHA256 Credential=ak-test/', $request->getHeaderLine('Authorization'));
        self::assertStringContainsString('SignedHeaders=content-type;', $request->getHeaderLine('Authorization'));
        self::assertStringNotContainsString('sk-test', $request->getHeaderLine('Authorization'));
    }

    public function testBlankOptionalConfigFallsBackToDefaults(): void
    {
        // 管理端把 version/region/service/endpoint 设为可留空，留空保存后键存在但值为空字符串；
        // 此时必须与「从未配置」等价，否则签名会带上空 region/service 而被火山拒绝。
        $client = $this->createClient($this->factory(['Result' => ['Id' => 'group-1']]), [
            'access_key' => 'ak-test',
            'secret_key' => 'sk-test',
            'version' => '',
            'region' => '  ',
            'service' => '',
            'endpoint' => '',
        ]);

        $client->request('CreateAssetGroup', ['Name' => '联调组', 'GroupType' => 'AIGC']);

        $request = $this->requests[0];
        self::assertSame('open.volcengineapi.com', $request->getUri()->getHost());
        self::assertSame('/?Action=CreateAssetGroup&Version=2024-01-01', (string) $request->getUri()->getPath() . '?' . $request->getUri()->getQuery());
        self::assertStringStartsWith('HMAC-SHA256 Credential=ak-test/', $request->getHeaderLine('Authorization'));
    }

    public function testSignatureDoesNotCarrySecurityToken(): void
    {
        $client = $this->createClient($this->factory(['Result' => ['Id' => 'group-1']]), $this->config());
        $client->request('CreateAssetGroup', ['Name' => '联调组', 'GroupType' => 'AIGC']);

        // 素材服务固定使用控制台长期 AK/SK，不带 STS 临时凭证的 X-Security-Token；
        // 该头一旦出现就会进入 SignedHeaders，导致签名与预期不一致，因此这里锁死行为。
        $request = $this->requests[0];
        self::assertFalse($request->hasHeader('X-Security-Token'));
        self::assertStringNotContainsString('x-security-token', strtolower($request->getHeaderLine('Authorization')));
    }

    public function testGetAssetStatusIsReturnedUnchanged(): void
    {
        $client = $this->createClient($this->factory(['Result' => ['Id' => 'asset-1', 'Status' => 'Processing']]), $this->config());
        $response = $client->request('GetAsset', ['Id' => 'asset-1', 'ProjectName' => 'default']);
        self::assertSame('Processing', $response['Result']['Status']);
        self::assertSame(['Id' => 'asset-1', 'ProjectName' => 'default'], json_decode((string) $this->requests[0]->getBody(), true, 512, JSON_THROW_ON_ERROR));
    }

    public function testRequestLogsFailureWhenConfigIsIncomplete(): void
    {
        $logger = new class extends AbstractLogger {
            /** @var array<int, string> */
            public array $messages = [];

            public function log($level, $message, array $context = []): void
            {
                $this->messages[] = (string) $message;
            }
        };
        $client = new VolcengineArkAssetsClient($this->createMock(ClientFactory::class), $logger, ['secret_key' => 'sk']);

        try {
            $client->request('GetAsset', []);
            self::fail('缺少 AK 时必须失败');
        } catch (InvalidArgumentException) {
        }

        // 配置校验发生在构建请求阶段，也必须留下失败日志，不能静默失败。
        self::assertContains('开始调用火山方舟 Assets 接口', $logger->messages);
        self::assertContains('火山方舟 Assets 接口调用失败', $logger->messages);
    }

    public function testRequestAllowingBusinessFailureReturnsBodyOnClientError(): void
    {
        $body = ['ResponseMetadata' => ['Error' => ['Code' => 'ResourceNotFound', 'Message' => 'not found']]];
        $client = $this->createClient($this->factory($body, 404), $this->config());

        $response = $client->requestAllowingBusinessFailure('DeleteAsset', ['Id' => 'asset-1', 'ProjectName' => 'default']);

        // 删除类操作要拿到业务错误码才能区分「已删干净」与「真的删失败」，因此不能直接抛异常。
        self::assertSame('ResourceNotFound', $response['ResponseMetadata']['Error']['Code']);
    }

    public function testRequestStillThrowsOnClientError(): void
    {
        $client = $this->createClient(
            $this->factory(['ResponseMetadata' => ['Error' => ['Code' => 'InvalidParameter']]], 400),
            $this->config(),
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('素材服务暂时不可用，请稍后重试');
        $client->request('DeleteAsset', ['Id' => 'asset-1']);
    }

    private function createClient(ClientFactory $factory, array $config): VolcengineArkAssetsClient
    {
        return new VolcengineArkAssetsClient($factory, new NullLogger(), $config);
    }

    /**
     * @param array<string, mixed> $body
     */
    private function factory(array $body, int $status = 200): ClientFactory
    {
        $mock = new MockHandler([new Response($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR))]);
        // 自行记录请求而不是用 Guzzle 的 history 中间件：history 写回的是数组，类型无法精确到 RequestInterface。
        $handler = function (RequestInterface $request, array $options) use ($mock): PromiseInterface {
            $this->requests[] = $request;
            return $mock($request, $options);
        };
        $http = new Client(['handler' => HandlerStack::create($handler)]);
        $factory = $this->createMock(ClientFactory::class);
        $factory->method('create')->willReturn($http);
        return $factory;
    }

    /**
     * @return array<string, string>
     */
    private function config(): array
    {
        return ['access_key' => 'ak-test', 'secret_key' => 'sk-test', 'region' => 'cn-beijing', 'endpoint' => 'https://open.volcengineapi.com', 'service' => 'ark', 'version' => '2024-01-01'];
    }
}
