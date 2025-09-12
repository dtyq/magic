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
            'logging' => [
                // 日志字段白名单配置
                // 如果为空数组或未配置，则打印所有字段
                // 如果配置了字段列表，则只打印指定的字段
                // 支持嵌套字段，使用点语法如 'args.messages'
                // 注意：messages 和 tools 字段不在白名单中，不会被打印
                'whitelist_fields' => [
                    // 基本请求信息
                    'request_id',                  // 请求ID
                    'model_id',                    // 模型ID
                    'model',                       // 模型名称
                    'duration_ms',                 // 请求耗时
                    'url',                         // 请求URL
                    'status_code',                 // 响应状态码

                    // options 信息
                    'options.headers',
                    'options.json.model',
                    'options.json.temperature',
                    'options.json.max_tokens',
                    'options.json.max_completion_tokens',
                    'options.json.stop',
                    'options.json.frequency_penalty',
                    'options.json.presence_penalty',
                    'options.json.business_params',
                    'options.json.thinking',

                    // 使用量统计
                    'usage',                       // 完整的usage对象
                    'usage.input_tokens',          // 输入token数量
                    'usage.output_tokens',         // 输出token数量
                    'usage.total_tokens',          // 总token数量

                    // 请求参数（排除敏感内容）
                    'args.temperature',            // 温度参数
                    'args.max_tokens',             // 最大token限制
                    'args.max_completion_tokens',             // 最大token限制
                    'args.top_p',                  // Top-p参数
                    'args.top_k',                  // Top-k参数
                    'args.frequency_penalty',      // 频率惩罚
                    'args.presence_penalty',       // 存在惩罚
                    'args.stream',                 // 流式响应标志
                    'args.stop',                   // 停止词
                    'args.seed',                   // 随机种子

                    // Token预估信息
                    'token_estimate',              // Token估算详情
                    'token_estimate.input_tokens', // 估算输入tokens
                    'token_estimate.output_tokens', // 估算输出tokens

                    // 响应内容（排除具体内容）
                    'choices.0.finish_reason',     // 完成原因
                    'choices.0.index',             // 选择索引

                    // 错误信息
                    'error',                       // 错误详情
                    'error.type',                  // 错误类型
                    'error.message',               // 错误消息（不包含具体内容）

                    // 其他元数据
                    'created',                     // 创建时间戳
                    'id',                         // 请求ID
                    'object',                     // 对象类型
                    'system_fingerprint',         // 系统指纹
                    'performance_flag',            // 性能标记（慢请求标识）

                    // 注意：以下字段被排除，不会打印
                    // - args.messages (用户消息内容)
                    // - args.tools (工具定义)
                    // - choices.0.message (响应消息内容)
                    // - choices.0.delta (流式响应增量内容)
                    // - content (响应内容)
                ],
                // 是否启用字段白名单过滤，默认true（启用过滤）
                'enable_whitelist' => env('ODIN_LOG_WHITELIST_ENABLED', true),
            ],
            'network_retry_count' => 1,
        ],
        'models' => $models,
        // 全局模型 options，可被模型本身的 options 覆盖
        'model_options' => [
            'error_mapping_rules' => [
                // 示例：自定义错误映射
                // '自定义错误关键词' => \Hyperf\Odin\Exception\LLMException\LLMTimeoutError::class,
            ],
        ],
        'model_fixed_temperature' => [
            '%gpt-5%' => 1,
        ],
    ],
    'content_copy_keys' => [
        'request-id', 'x-b3-trace-id', 'FlowEventStreamManager::EventStream',
    ],
];
