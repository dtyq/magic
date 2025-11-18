<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Chat\Entity\ValueObject\SearchEngineType;
use App\Infrastructure\ExternalAPI\Search\Adapter\BingSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\CloudswaySearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\DuckDuckGoSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\GoogleSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\JinaSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\MagicSearchAdapter;
use App\Infrastructure\ExternalAPI\Search\Adapter\TavilySearchAdapter;

/*
 * Copyright (c) The Magic , Distributed under the software license.
 */
use function Hyperf\Support\env;

return [
    'backend' => env('SEARCH_BACKEND', 'bing'),
    'drivers' => [
        SearchEngineType::Magic->value => [
            'class_name' => MagicSearchAdapter::class,
            'base_url' => env('MAGIC_SEARCH_BASE_URL', ''),
            'api_key' => env('MAGIC_SEARCH_API_KEY', ''),
        ],
        SearchEngineType::Tavily->value => [
            'class_name' => TavilySearchAdapter::class,
            'api_key' => env('TAVILY_API_KEY', ''),
        ],
        SearchEngineType::Google->value => [
            'class_name' => GoogleSearchAdapter::class,
            // 如果你使用GOOGLE，你需要指定搜索API密钥。注意你还应该在env中指定cx。
            'api_key' => env('GOOGLE_SEARCH_API_KEY', ''),
            // 如果你在使用google，请指定搜索cx,也就是GOOGLE_SEARCH_ENGINE_ID
            'cx' => env('GOOGLE_SEARCH_CX', ''),
        ],
        SearchEngineType::Bing->value => [
            'class_name' => BingSearchAdapter::class,
            'endpoint' => env('BING_SEARCH_ENDPOINT', 'https://api.bing.microsoft.com/v7.0/search'),
            'api_key' => env('BING_SEARCH_API_KEY', ''),
            'mkt' => env('BING_SEARCH_MKT', 'zh-CN'),
        ],
        SearchEngineType::DuckDuckGo->value => [
            'class_name' => DuckDuckGoSearchAdapter::class,
            'region' => env('BING_SEARCH_MKT', 'cn-zh'),
        ],
        SearchEngineType::Jina->value => [
            'class_name' => JinaSearchAdapter::class,
            'api_key' => env('JINA_SEARCH_API_KEY', ''),
            'region' => env('JINA_SEARCH_REGION'),
        ],
        SearchEngineType::Cloudsway->value => [
            'class_name' => CloudswaySearchAdapter::class,
            'base_path' => env('CLOUDSWAY_BASE_PATH', ''),
            'endpoint' => env('CLOUDSWAY_ENDPOINT', ''),  // 从 console.cloudsway.ai 获取
            'access_key' => env('CLOUDSWAY_ACCESS_KEY', ''),  // 从 console.cloudsway.ai 获取
        ],
    ],
];
