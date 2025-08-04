<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\Hyperf\Odin\Model\MiscEmbeddingModel;
use Hyperf\Odin\Model\AwsBedrockModel;
use Hyperf\Odin\Model\AzureOpenAIModel;
use Hyperf\Odin\Model\DoubaoModel;
use Hyperf\Odin\Model\OpenAIModel;

use function Hyperf\Support\env;

// 处理配置中的环境变量
function processModelConfig(&$modelItem, string $modelName): void
{
    // 处理模型值
    if (isset($modelItem['model'])) {
        $modelItemModel = explode('|', $modelItem['model']);
        if (count($modelItemModel) > 1) {
            $modelItem['model'] = env($modelItemModel[0], $modelItemModel[1]);
        } else {
            $modelItem['model'] = env($modelItemModel[0], $modelItemModel[0]);
        }
    } else {
        $modelItem['model'] = $modelName;
    }

    // 处理配置值
    if (isset($modelItem['config']) && is_array($modelItem['config'])) {
        foreach ($modelItem['config'] as &$item) {
            $value = explode('|', $item);
            if (count($value) > 1) {
                $item = env($value[0], $value[1]);
            } else {
                $item = env($value[0], $value[0]);
            }
        }
    }

    // 优雅的打印加载成功的模型
    echo "\033[32m✓\033[0m 模型加载成功: \033[1m" . $modelName . ' (' . $modelItem['model'] . ")\033[0m" . PHP_EOL;
}

$envModelConfigs = [];
// AzureOpenAI gpt-4o
if (env('AZURE_OPENAI_GPT4O_ENABLED', false)) {
    $envModelConfigs['gpt-4o-global'] = [
        'model' => 'AZURE_OPENAI_4O_GLOBAL_MODEL|gpt-4o-global',
        'implementation' => AzureOpenAIModel::class,
        'config' => [
            'api_key' => 'AZURE_OPENAI_4O_GLOBAL_API_KEY',
            'base_url' => 'AZURE_OPENAI_4O_GLOBAL_BASE_URL',
            'api_version' => 'AZURE_OPENAI_4O_GLOBAL_API_VERSION',
            'deployment_name' => 'AZURE_OPENAI_4O_GLOBAL_DEPLOYMENT_NAME',
        ],
        'model_options' => [
            'chat' => true,
            'function_call' => true,
            'embedding' => false,
            'multi_modal' => true,
            'vector_size' => 0,
        ],
    ];
}

// 豆包Pro 32k
if (env('DOUBAO_PRO_32K_ENABLED', false)) {
    $envModelConfigs['doubao-pro-32k'] = [
        'model' => 'DOUBAO_PRO_32K_ENDPOINT|doubao-1.5-pro-32k',
        'implementation' => DoubaoModel::class,
        'config' => [
            'api_key' => 'DOUBAO_PRO_32K_API_KEY',
            'base_url' => 'DOUBAO_PRO_32K_BASE_URL|https://ark.cn-beijing.volces.com',
        ],
        'model_options' => [
            'chat' => true,
            'function_call' => true,
            'embedding' => false,
            'multi_modal' => false,
            'vector_size' => 0,
        ],
    ];
}

// DeepSeek R1
if (env('DEEPSEEK_R1_ENABLED', false)) {
    $envModelConfigs['deepseek-r1'] = [
        'model' => 'DEEPSEEK_R1_ENDPOINT|deepseek-reasoner',
        'implementation' => OpenAIModel::class,
        'config' => [
            'api_key' => 'DEEPSEEK_R1_API_KEY',
            'base_url' => 'DEEPSEEK_R1_BASE_URL|https://api.deepseek.com',
        ],
        'model_options' => [
            'chat' => true,
            'function_call' => false,
            'embedding' => false,
            'multi_modal' => false,
            'vector_size' => 0,
        ],
    ];
}

// DeepSeek V3
if (env('DEEPSEEK_V3_ENABLED', false)) {
    $envModelConfigs['deepseek-v3'] = [
        'model' => 'DEEPSEEK_V3_ENDPOINT|deepseek-chat',
        'implementation' => OpenAIModel::class,
        'config' => [
            'api_key' => 'DEEPSEEK_V3_API_KEY',
            'base_url' => 'DEEPSEEK_V3_BASE_URL|https://api.deepseek.com',
        ],
        'model_options' => [
            'chat' => true,
            'function_call' => false,
            'embedding' => false,
            'multi_modal' => false,
            'vector_size' => 0,
        ],
    ];
}

// 豆包 Embedding
if (env('DOUBAO_EMBEDDING_ENABLED', false)) {
    $envModelConfigs['doubao-embedding-text-240715'] = [
        'model' => 'DOUBAO_EMBEDDING_ENDPOINT|doubao-embedding-text-240715',
        'implementation' => DoubaoModel::class,
        'config' => [
            'api_key' => 'DOUBAO_EMBEDDING_API_KEY',
            'base_url' => 'DOUBAO_EMBEDDING_BASE_URL|https://ark.cn-beijing.volces.com',
        ],
        'model_options' => [
            'chat' => false,
            'function_call' => false,
            'multi_modal' => false,
            'embedding' => true,
            'vector_size' => env('DOUBAO_EMBEDDING_VECTOR_SIZE', 2560),
        ],
    ];
}

// dmeta-embedding
if (env('MISC_DMETA_EMBEDDING_ENABLED', false)) {
    $envModelConfigs['dmeta-embedding'] = [
        'model' => 'MISC_DMETA_EMBEDDING_ENDPOINT|dmeta-embedding',
        'implementation' => MiscEmbeddingModel::class,
        'config' => [
            'api_key' => 'MISC_DMETA_EMBEDDING_API_KEY',
            'base_url' => 'MISC_DMETA_EMBEDDING_BASE_URL',
        ],
        'model_options' => [
            'chat' => false,
            'function_call' => false,
            'multi_modal' => false,
            'embedding' => true,
            'vector_size' => env('MISC_DMETA_EMBEDDING_VECTOR_SIZE', 768),
        ],
    ];
}

// Aws claude3.7
if (env('AWS_CLAUDE_ENABLED', false)) {
    $envModelConfigs['claude-3-7'] = [
        'model' => 'AWS_CLAUDE_3_7_ENDPOINT|claude-3-7',
        'implementation' => AwsBedrockModel::class,
        'config' => [
            'access_key' => 'AWS_CLAUDE3_7_ACCESS_KEY',
            'secret_key' => 'AWS_CLAUDE3_7_SECRET_KEY',
            'region' => 'AWS_CLAUDE3_7_REGION|us-east-1',
        ],
        'model_options' => [
            'chat' => true,
            'function_call' => true,
            'multi_modal' => true,
            'embedding' => false,
            'vector_size' => 0,
        ],
        'api_options' => [
            'proxy' => env('AWS_CLAUDE3_7_PROXY', ''),
        ],
    ];
}

// 加载默认模型配置（优先级最低）
$models = [];

// 加载默认模型配置
foreach ($envModelConfigs as $modelKey => $config) {
    processModelConfig($config, $modelKey);
    $models[$modelKey] = $config;
}

// 加载 odin_models.json 配置（优先级更高，会覆盖默认配置）
if (file_exists(BASE_PATH . '/odin_models.json')) {
    $customModels = json_decode(file_get_contents(BASE_PATH . '/odin_models.json'), true);
    if (is_array($customModels)) {
        foreach ($customModels as $key => $modelItem) {
            processModelConfig($modelItem, $key);
            $models[$key] = $modelItem;
        }
    }
}

return [
    'llm' => [
        'default' => '',
        'general_model_options' => [
            'chat' => true,
            'function_call' => false,
            'embedding' => false,
            'multi_modal' => false,
            'vector_size' => 0,
        ],
        'general_api_options' => [
            'timeout' => [
                'connection' => 5.0,  // 连接超时（秒）
                'write' => 10.0,      // 写入超时（秒）
                'read' => 300.0,      // 读取超时（秒）
                'total' => 350.0,     // 总体超时（秒）
                'thinking' => 120.0,  // 思考超时（秒）
                'stream_chunk' => 30.0, // 流式块间超时（秒）
                'stream_first' => 60.0, // 首个流式块超时（秒）
            ],
            'custom_error_mapping_rules' => [],
            'http_handler' => 'stream',
        ],
        'models' => $models,
        // 全局模型 options，可被模型本身的 options 覆盖
        'model_options' => [
            'error_mapping_rules' => [
                // 示例：自定义错误映射
                // '自定义错误关键词' => \Hyperf\Odin\Exception\LLMException\LLMTimeoutError::class,
            ],
        ],
    ],
    'content_copy_keys' => [
        'request-id', 'x-b3-trace-id', 'FlowEventStreamManager::EventStream',
    ],
];
