<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Ops\Facade;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Ops\Facade\SocketIORedisOpsApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * @internal
 */
class SocketIORedisOpsApiTest extends TestCase
{
    public function testCleanupForwardsOfficialOrganizationRequestToGoRPC(): void
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $this->assertNotSame('', $officialOrganizationCode, 'official organization code must be configured');

        $request = $this->newRequestMock([
            'prefix' => 'magicChat:SocketIo:RedisAdapter:v2',
            'apply' => 'true',
            'count' => '2000',
            'sample_limit' => '12',
        ]);

        $rpcClientManager = $this->createMock(RpcClientManager::class);
        $rpcClientManager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_SOCKETIO_REDIS . '.' . SvcMethods::METHOD_CLEANUP,
                $this->callback(function (array $payload) use ($officialOrganizationCode): bool {
                    $this->assertSame([
                        'data_isolation' => [
                            'organization_code' => $officialOrganizationCode,
                        ],
                        'prefix' => 'magicChat:SocketIo:RedisAdapter:v2',
                        'apply' => true,
                        'count' => 2000,
                        'sample_limit' => 12,
                    ], $payload);
                    return true;
                }),
                10.0
            )
            ->willReturn([
                'job_id' => 'job-1',
                'status' => 'running',
            ]);

        $api = $this->newApi($request, $rpcClientManager, $officialOrganizationCode);

        $response = $api->cleanup();
        $data = $response['data'] ?? $response;
        $this->assertSame('job-1', $data['job_id'] ?? null);
        $this->assertSame('running', $data['status'] ?? null);
    }

    public function testCleanupRejectsNonOfficialOrganizationWithoutGoRPC(): void
    {
        $request = $this->newRequestMock([
            'prefix' => 'magicChat:SocketIo:RedisAdapter:v2',
        ]);
        $request->expects($this->never())->method('input');

        $rpcClientManager = $this->createMock(RpcClientManager::class);
        $rpcClientManager->expects($this->never())->method('call');

        $api = $this->newApi($request, $rpcClientManager, 'non-official-org');

        try {
            $response = $api->cleanup();
        } catch (BusinessException $exception) {
            $this->assertSame(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE->value, $exception->getCode());
            return;
        }

        $this->assertSame(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE->value, $response['code'] ?? null);
    }

    /**
     * @param array<string, mixed> $inputs
     */
    private function newRequestMock(array $inputs): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('input')
            ->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $inputs[$key] ?? $default);

        return $request;
    }

    private function newApi(
        RequestInterface $request,
        RpcClientManager $rpcClientManager,
        string $organizationCode,
    ): SocketIORedisOpsApi {
        $authorization = (new MagicUserAuthorization())->setOrganizationCode($organizationCode);

        return new class($request, $rpcClientManager, $authorization) extends SocketIORedisOpsApi {
            public function __construct(
                RequestInterface $request,
                RpcClientManager $rpcClientManager,
                private readonly MagicUserAuthorization $authorization,
            ) {
                parent::__construct($request, $rpcClientManager);
            }

            protected function getAuthorization(): Authenticatable
            {
                return $this->authorization;
            }
        };
    }
}
