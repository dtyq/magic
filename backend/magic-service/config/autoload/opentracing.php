<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Tracer\Adapter\ZipkinTracerFactory;
use Zipkin\Samplers\BinarySampler;

use function Hyperf\Support\env;

return [
    'enable_opentracing' => env('ENABLE_OPENTRACING', true),
    'default' => env('TRACER_DRIVER', 'zipkin'),
    'prefix' => env('TRACER_PREFIX', 'brd'),
    'enable' => [
        'guzzle' => env('TRACER_ENABLE_GUZZLE', true),
        'redis' => env('TRACER_ENABLE_REDIS', true),
        'db' => env('TRACER_ENABLE_DB', true),
        'elasticsearch' => env('TRACER_ENABLE_ELASTICSEARCH', true),
        'json_rpc' => env('TRACER_ENABLE_JSONRPC', true),
        'method' => env('TRACER_ENABLE_METHOD', false),
        'exception' => env('TRACER_ENABLE_EXCEPTION', true),
    ],
    'tracer' => [
        // 主pod
        'zipkin' => [
            'driver' => ZipkinTracerFactory::class,
            'app' => [
                'name' => sprintf('%s-%s', env('APP_NAME'), env('TRACER_PREFIX', env('APP_ENV'))),
                // Hyperf will detect the system info automatically as the value if ipv4, ipv6, port is null
                'ipv4' => '0.0.0.0',
                'ipv6' => null,
                'port' => 9501,
            ],
            'options' => [
                'endpoint_url' => env('ZIPKIN_ENDPOINT_URL', '') . '/api/v2/spans',
                'timeout' => env('ZIPKIN_TIMEOUT', 1),
            ],
            'sampler' => BinarySampler::createAsAlwaysSample(),
        ],
    ],
    'tags' => [
        'http_client' => [
            'http.url' => 'http.url',
            'http.method' => 'http.method',
            'http.status_code' => 'http.status_code',
        ],
        'redis' => [
            'arguments' => 'arguments',
            'result' => 'result',
        ],
        'db' => [
            'db.query' => 'db.query',
            'db.statement' => 'db.statement',
            'db.query_time' => 'db.query_time',
        ],
        'exception' => [
            'class' => 'exception.class',
            'code' => 'exception.code',
            'message' => 'exception.message',
            'stack_trace' => 'exception.stack_trace',
        ],
        'error' => [
            'event' => 'exception.class',
            'error.kind' => 'exception.code',
            'error.object' => 'exception.message',
            'message' => 'exception.stack_trace',
        ],
        'request' => [
            'path' => 'request.path',
            'method' => 'request.method',
            'header' => 'request.header',
            'uri' => 'request.uri',
        ],
        'coroutine' => [
            'id' => 'coroutine.id',
        ],
        'response' => [
            'status_code' => 'response.status_code',
        ],
    ],
];
