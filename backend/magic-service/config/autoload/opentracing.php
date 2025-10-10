<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Stringable\Str;
use Hyperf\Tracer\Adapter\ZipkinTracerFactory;
use Zipkin\Samplers\BinarySampler;

use function Hyperf\Support\env;

/**
 * 由于阿里云和火山云的URL地址格式不同,因此在此处进行适配解析.
 * @note 注意！opentracing.php文件中，直接配置'endpoint_url' => $endpointUrl ,不要再拼接其他字符
 */
function multiCloudAdapter(string $endpointUrl): string
{
    if (Str::contains($endpointUrl, 'volces')) {
        // 火山云地址,但是配置文件中的格式可能是按阿里云的表示,无法直接使用
        preg_match('#(.*)/third_party/zipkin/v2/(\w+)/.*#u', $endpointUrl, $matches);
        // URL还原
        $endpointUrl = sprintf('%s/third_party/zipkin/v2/%s/api/v2/spans', $matches[1], $matches[2]);
    }

    // 阿里云.检测环境变量的值是否包含 /api/v2/spans,如果不包含则添加
    if (Str::contains($endpointUrl, 'aliyuncs') && ! Str::contains($endpointUrl, 'api/v2/spans')) {
        $endpointUrl = rtrim($endpointUrl, '/') . '/api/v2/spans';
    }
    return $endpointUrl;
}

$endpointUrl = multiCloudAdapter(env('ZIPKIN_ENDPOINT_URL', ''));

return [
    'default' => env('TRACER_DRIVER', 'zipkin'),
    'prefix' => env('TRACER_PREFIX', ''),
    'enable' => [
        'guzzle' => env('TRACER_ENABLE_GUZZLE', true),
        'redis' => env('TRACER_ENABLE_REDIS', true),
        'db' => env('TRACER_ENABLE_DB', true),
        'simple_db' => env('TRACER_ENABLE_DB', true),
        'elasticsearch' => env('TRACER_ENABLE_ELASTICSEARCH', true),
        'method' => env('TRACER_ENABLE_METHOD', true),
        'exception' => env('TRACER_ENABLE_EXCEPTION', true),
    ],
    'tracer' => [
        // 主pod
        'zipkin' => [
            'driver' => ZipkinTracerFactory::class,
            'app' => [
                'name' => sprintf('%s-%s', env('APP_NAME'), env('APP_ENV')),
                // Hyperf will detect the system info automatically as the value if ipv4, ipv6, port is null
                'ipv4' => '0.0.0.0',
                'ipv6' => null,
                'port' => 9501,
            ],
            'options' => [
                'endpoint_url' => $endpointUrl,
                'timeout' => env('ZIPKIN_TIMEOUT', 1),
            ],
            'sampler' => BinarySampler::createAsAlwaysSample(),
        ],
        // 多个pod
        'zipkin-sync' => [
            'driver' => ZipkinTracerFactory::class,
            'app' => [
                'name' => sprintf('%s-%s-sync', env('APP_NAME'), env('APP_ENV')),
                // Hyperf will detect the system info automatically as the value if ipv4, ipv6, port is null
                'ipv4' => '0.0.0.0',
                'ipv6' => null,
                'port' => 9501,
            ],
            'options' => [
                'endpoint_url' => $endpointUrl,
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
