<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Builder;

use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Api\Api;
use Dtyq\FlowExprEngine\Structure\Api\ApiMethod;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequest;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequestBodyType;

class ApiBuilder extends Builder
{
    public function build(array $structure): ?Api
    {
        if (! $structure) {
            return null;
        }
        $method = $structure['method'] ?? null;
        if ($method) {
            $method = strtoupper($method);
        }
        $apiMethod = ApiMethod::from($method);

        $api = null;
        if (isset($structure['path'])) {
            $api = new Api(
                apiMethod: $apiMethod,
                domain: $structure['domain'] ?? '',
                path: $structure['path'],
                proxy: $structure['proxy'] ?? '',
                auth: $structure['auth'] ?? ''
            );
        } elseif (isset($structure['url'])) {
            $api = Api::createByUrl($apiMethod, $structure['url']);
        }
        if (! $api) {
            return null;
        }
        $api->setProxy($structure['proxy'] ?? '');
        $api->setAuth($structure['auth'] ?? '');
        $api->setRequest($this->buildRequest($structure['request'] ?? []));

        return $api;
    }

    public function template(string $componentId, array $structure = []): ?Api
    {
        $template = json_decode(
            <<<'JSON'
{
    "method": "GET",
    "domain": "",
    "path": "",
    "url": "",
    "auth": "",
    "request":{
        "params_path":{
            "id":null,
            "type":"form",
            "version":"1",
            "structure":{
                "type":"object",
                "key":"root",
                "sort":0,
                "title":null,
                "description":null,
                "items":null,
                "value":null,
                "required":[

                ],
                "properties":null
            }
        },
        "params_query":{
            "id":null,
            "type":"form",
            "version":"1",
            "structure":{
                "type":"object",
                "key":"root",
                "sort":0,
                "title":null,
                "description":null,
                "items":null,
                "value":null,
                "required":[

                ],
                "properties":null
            }
        },
        "body_type":"json",
        "body":{
            "id":null,
            "type":"form",
            "version":"1",
            "structure":{
                "type":"object",
                "key":"root",
                "sort":0,
                "title":null,
                "description":null,
                "items":null,
                "value":null,
                "required":[

                ],
                "properties":null
            }
        },
        "headers":{
            "id":null,
            "type":"form",
            "version":"1",
            "structure":{
                "type":"object",
                "key":"root",
                "sort":0,
                "title":null,
                "description":null,
                "items":null,
                "value":null,
                "required":[

                ],
                "properties":null
            }
        }
    },
    "response_check":null
}
JSON,
            true
        );
        if (! empty($structure)) {
            $template = $structure;
        }
        return $this->build($template);
    }

    private static function buildRequest(array $request): ApiRequest
    {
        $apiRequest = new ApiRequest();
        $apiRequest->setParamsQuery(ComponentFactory::fastCreate($request['params_query'] ?? []));
        $apiRequest->setParamsPath(ComponentFactory::fastCreate($request['params_path'] ?? []));
        $apiRequest->setApiRequestBodyType(ApiRequestBodyType::make($request['body_type'] ?? 'none'));
        $apiRequest->setBody(ComponentFactory::fastCreate($request['body'] ?? []));
        $apiRequest->setHeaders(ComponentFactory::fastCreate($request['headers'] ?? []));
        return $apiRequest;
    }
}
