<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Interfaces\Authentication\Facade;

use App\Application\Authentication\Service\ModelGatewayTokenAppService;
use App\Domain\Token\DTO\ModelGatewayTokenDTO;
use App\Domain\Token\Service\ModelGatewayTokenDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authentication\Facade\ModelGatewayTokenApi;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayTokenApiTest extends TestCase
{
    protected function tearDown(): void
    {
        $this->setAuthorizationContext('');
        parent::tearDown();
    }

    public function testIssueModelGatewayTokenUsesAuthorizationContextWithoutBodyValidation(): void
    {
        $this->setAuthorizationContext('user_issue_1');

        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->never())->method('all');
        $request->method('getHeaderLine')->willReturnMap([
            ['x-forwarded-for', ''],
            ['x-real-ip', ''],
        ]);
        $request->expects($this->once())->method('getServerParams')->willReturn(['remote_addr' => '127.0.0.1']);

        $domainService = $this->createMock(ModelGatewayTokenDomainService::class);
        $domainService->expects($this->once())
            ->method('issueToken')
            ->with(
                'user_issue_1',
                $this->callback(static function (array $auditContext): bool {
                    return ($auditContext['header_source'] ?? null) === 'issue'
                        && ($auditContext['client_ip'] ?? null) === '127.0.0.1';
                })
            )
            ->willReturn(new ModelGatewayTokenDTO(
                'mgw_api_key_issued',
                'refresh_token_issued',
                '2026-02-26 12:00:00',
                '2026-03-05 12:00:00'
            ));

        $appService = new ModelGatewayTokenAppService($domainService);
        $api = new ModelGatewayTokenApi($request, $appService);
        $result = $api->issueModelGatewayToken();

        $this->assertSame([
            'code' => 1000,
            'message' => 'ok',
            'data' => [
                'api_key' => 'mgw_api_key_issued',
                'refresh_token' => 'refresh_token_issued',
                'api_key_expires_at' => '2026-02-26 12:00:00',
                'refresh_token_expires_at' => '2026-03-05 12:00:00',
            ],
        ], $result);
    }

    public function testRefreshModelGatewayTokenRejectsNonJsonContentType(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())->method('getHeaderLine')->with('content-type')->willReturn('text/plain');
        $request->expects($this->never())->method('all');

        $domainService = $this->createMock(ModelGatewayTokenDomainService::class);
        $domainService->expects($this->never())->method('refreshToken');

        $appService = new ModelGatewayTokenAppService($domainService);
        $api = new ModelGatewayTokenApi($request, $appService);
        $result = $api->refreshModelGatewayToken();
        $this->assertSame(GenericErrorCode::ParameterValidationFailed->value, $result['code']);
    }

    public function testRefreshModelGatewayTokenRejectsMissingRefreshToken(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('getHeaderLine')->willReturnMap([
            ['content-type', 'application/json'],
        ]);
        $request->expects($this->once())->method('all')->willReturn([]);

        $domainService = $this->createMock(ModelGatewayTokenDomainService::class);
        $domainService->expects($this->never())->method('refreshToken');

        $appService = new ModelGatewayTokenAppService($domainService);
        $api = new ModelGatewayTokenApi($request, $appService);
        $result = $api->refreshModelGatewayToken();
        $this->assertSame(GenericErrorCode::ParameterValidationFailed->value, $result['code']);
    }

    public function testRefreshModelGatewayTokenRejectsAdditionalFields(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('getHeaderLine')->willReturnMap([
            ['content-type', 'application/json'],
        ]);
        $request->expects($this->once())->method('all')->willReturn([
            'refresh_token' => 'refresh_token_1',
            'extra' => 'field',
        ]);

        $domainService = $this->createMock(ModelGatewayTokenDomainService::class);
        $domainService->expects($this->never())->method('refreshToken');

        $appService = new ModelGatewayTokenAppService($domainService);
        $api = new ModelGatewayTokenApi($request, $appService);
        $result = $api->refreshModelGatewayToken();
        $this->assertSame(GenericErrorCode::ParameterValidationFailed->value, $result['code']);
    }

    public function testRefreshModelGatewayTokenAcceptsValidJsonBody(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('getHeaderLine')->willReturnCallback(static function (string $headerName): string {
            return match ($headerName) {
                'content-type' => 'application/json; charset=utf-8',
                'x-forwarded-for' => '10.0.0.1, 10.0.0.2',
                'x-real-ip' => '',
                default => '',
            };
        });
        $request->expects($this->once())->method('all')->willReturn([
            'refresh_token' => '  refresh_token_valid  ',
        ]);
        $request->expects($this->once())->method('getServerParams')->willReturn(['remote_addr' => '127.0.0.9']);

        $domainService = $this->createMock(ModelGatewayTokenDomainService::class);
        $domainService->expects($this->once())
            ->method('refreshToken')
            ->with(
                'refresh_token_valid',
                $this->callback(static function (array $auditContext): bool {
                    return ($auditContext['header_source'] ?? null) === 'refresh'
                        && ($auditContext['client_ip'] ?? null) === '10.0.0.1';
                })
            )
            ->willReturn(new ModelGatewayTokenDTO(
                'mgw_api_key_refreshed',
                'refresh_token_refreshed',
                '2026-02-26 12:00:00',
                '2026-03-05 12:00:00'
            ));

        $appService = new ModelGatewayTokenAppService($domainService);
        $api = new ModelGatewayTokenApi($request, $appService);
        $result = $api->refreshModelGatewayToken();

        $this->assertSame([
            'code' => 1000,
            'message' => 'ok',
            'data' => [
                'api_key' => 'mgw_api_key_refreshed',
                'refresh_token' => 'refresh_token_refreshed',
                'api_key_expires_at' => '2026-02-26 12:00:00',
                'refresh_token_expires_at' => '2026-03-05 12:00:00',
            ],
        ], $result);
    }

    private function setAuthorizationContext(string $userId): void
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId($userId);
        RequestCoContext::setUserAuthorization($authorization);
    }
}
