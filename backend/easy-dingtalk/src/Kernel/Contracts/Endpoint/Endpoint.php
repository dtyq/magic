<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint;

use Dtyq\EasyDingTalk\Kernel\Constants\ErrorCode;
use Dtyq\EasyDingTalk\Kernel\Contracts\ApiManager\ApiInterface;
use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\SdkBase\SdkBase;
use Psr\Http\Message\ResponseInterface;
use Throwable;

abstract class Endpoint implements EndpointInterface
{
    public function __construct(
        protected readonly SdkBase $sdkBase
    ) {
    }

    protected function getResult(ApiInterface $api): array
    {
        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        if (! is_array($data)) {
            throw new BadRequestException('Invalid response content');
        }
        if (! isset($data['errcode']) || $data['errcode'] !== 0) {
            throw new BadRequestException((string) ($data['errmsg'] ?? '请求失败'), (int) ($data['errcode'] ?? ErrorCode::BAD_REQUEST));
        }
        return $data['result'] ?? [];
    }

    protected function send(ApiInterface $api): ResponseInterface
    {
        $uri = $api->getUri();
        if (! empty($api->getPathParams())) {
            foreach ($api->getPathParams() as $key => $value) {
                $uri = str_replace('{' . $key . '}', $value, $uri);
            }
        }
        try {
            return $this->sdkBase->getClientRequest()->request(
                method: $api->getMethod(),
                uri: $api->getHost() . $uri,
                options: $api->getOptions()
            );
        } catch (Throwable $throwable) {
            throw new BadRequestException($throwable->getMessage(), $throwable->getCode(), $throwable);
        }
    }
}
