<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Ops\Facade;

use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse(version: 'low_code')]
class SocketIORedisOpsApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly RpcClientManager $rpcClientManager,
    ) {
        parent::__construct($request);
    }

    public function cleanup(): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();
        if (! OfficialOrganizationUtil::isOfficialOrganization($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }

        $prefix = trim((string) $this->request->input('prefix', ''));
        if ($prefix === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'prefix is required');
        }

        $payload = [
            'data_isolation' => [
                'organization_code' => $organizationCode,
            ],
            'prefix' => $prefix,
            'apply' => $this->boolInput('apply', false),
            'count' => $this->intInput('count', 1000),
            'sample_limit' => $this->intInput('sample_limit', 10),
        ];

        return $this->rpcClientManager->call(
            SvcMethods::SERVICE_SOCKETIO_REDIS . '.' . SvcMethods::METHOD_CLEANUP,
            $payload,
            10.0
        );
    }

    private function intInput(string $key, int $default): int
    {
        $value = $this->request->input($key, $default);
        if (is_int($value)) {
            return $value;
        }
        if (is_string($value) && preg_match('/^-?\d+$/', trim($value)) === 1) {
            return (int) $value;
        }
        if (is_float($value)) {
            return (int) $value;
        }
        ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, sprintf('%s is invalid', $key));
    }

    private function boolInput(string $key, bool $default): bool
    {
        $value = $this->request->input($key, $default);
        if (is_bool($value)) {
            return $value;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($parsed !== null) {
            return $parsed;
        }
        ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, sprintf('%s is invalid', $key));
    }
}
