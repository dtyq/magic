<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    'backend' => env('SEARCH_BACKEND', 'bing'),
    'drivers' => [
        'tavily' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\TavilySearchAdapter::class,
            'api_key' => env('TAVILY_API_KEY', ''),
        ],
        'google' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\GoogleSearchAdapter::class,
            // 如果你使用GOOGLE，你需要指定搜索API密钥。注意你还应该在env中指定cx。
            'api_key' => env('GOOGLE_SEARCH_API_KEY', ''),
            // 如果你在使用google，请指定搜索cx,也就是GOOGLE_SEARCH_ENGINE_ID
            'cx' => env('GOOGLE_SEARCH_CX', ''),
        ],
        'bing' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\BingSearchAdapter::class,
            'endpoint' => env('BING_SEARCH_ENDPOINT', 'https://api.bing.microsoft.com/v7.0/search'),
            'api_key' => env('BING_SEARCH_API_KEY', ''),
            'mkt' => env('BING_SEARCH_MKT', 'zh-CN'),
        ],
        'duckduckgo' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\DuckDuckGoSearchAdapter::class,
            'region' => env('BING_SEARCH_MKT', 'cn-zh'),
        ],
        'jina' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\JinaSearchAdapter::class,
            'api_key' => env('JINA_SEARCH_API_KEY', ''),
            'region' => env('JINA_SEARCH_REGION'),
        ],
        'cloudsway' => [
            'class_name' => \App\Infrastructure\ExternalAPI\Search\Adapter\CloudswaySearchAdapter::class,
            'base_path' => env('CLOUDSWAY_BASE_PATH', ''),
            'endpoint' => env('CLOUDSWAY_ENDPOINT', ''),  // 从 console.cloudsway.ai 获取
            'access_key' => env('CLOUDSWAY_ACCESS_KEY', ''),  // 从 console.cloudsway.ai 获取
        ],
    ],
    // Legacy configuration keys for backward compatibility
    'tavily' => [
        'api_key' => env('TAVILY_API_KEY', ''),
    ],
    'google' => [
        // 如果你使用GOOGLE，你需要指定搜索API密钥。注意你还应该在env中指定cx。
        'api_key' => env('GOOGLE_SEARCH_API_KEY', ''),
        // 如果你在使用google，请指定搜索cx,也就是GOOGLE_SEARCH_ENGINE_ID
        'cx' => env('GOOGLE_SEARCH_CX', ''),
    ],
    'bing' => [
        'endpoint' => env('BING_SEARCH_ENDPOINT', 'https://api.bing.microsoft.com/v7.0/search'),
        'api_key' => env('BING_SEARCH_API_KEY', ''),
        'mkt' => env('BING_SEARCH_MKT', 'zh-CN'),
    ],
    'duckduckgo' => [
        'region' => env('BING_SEARCH_MKT', 'cn-zh'),
    ],
    'jina' => [
        'api_key' => env('JINA_SEARCH_API_KEY', ''),
        'region' => env('JINA_SEARCH_REGION'),
    ],
    'cloudsway' => [
        'base_path' => env('CLOUDSWAY_BASE_PATH', ''),
        'endpoint' => env('CLOUDSWAY_ENDPOINT', ''),  // 从 console.cloudsway.ai 获取
        'access_key' => env('CLOUDSWAY_ACCESS_KEY', ''),  // 从 console.cloudsway.ai 获取
    ],
];
