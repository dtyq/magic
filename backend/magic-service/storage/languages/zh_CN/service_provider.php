<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'system_error' => '系统错误',
    'model_not_found' => '模型未找到',
    'invalid_model_type' => '无效的模型类型',
    'service_provider_not_found' => '服务商未找到',
    'service_provider_config_error' => '服务商配置错误',
    'request_failed' => '请求失败',
    'response_parse_error' => '响应解析错误',
    'quota_exceeded' => '配额已超限',
    'invalid_parameter' => '无效的参数',
    'model_not_active' => '模型未激活',
    'service_provider_not_active' => '服务商未激活',
    'ak_sk_empty' => 'ak,sk为空',
    'api_key_empty' => 'api_key为空',
    'init_organization_providers_failed' => '初始化服务商失败',
    'original_model_already_exists' => '模型已存在',
    'load_balancing_weight_range_error' => '负载均衡权重必须在0-100之间',
    'model_officially_disabled' => '模型已被官方禁用',
    'magic_provider_not_found' => 'Magic服务商配置不存在',
    'original_model_id_already_exists' => '原始模型ID已存在',
    'original_model_id_already_exists_in_group' => '分组「:group_name」中的动态模型配置已存在：:model_label，请直接编辑现有模型',
    'original_model_not_found' => '原始模型不存在',
    'invalid_pricing' => '价格不能小于0',
    'creativity_temperature_conflict' => 'creativity 和 temperature 不能同时设置值',
    'creativity_value_range_error' => 'creativity 值必须在 0-2 范围内',
    'temperature_value_range_error' => 'temperature 值必须在 0-2 范围内',
    'ai_ability_not_found' => 'AI能力不存在',
    'ai_ability_disabled' => 'AI能力未启用',
    'config_disabled' => '服务商配置已禁用',
    'config_not_found' => '服务商配置不存在',
    'config_load_failed' => '配置加载失败',
    'connectivity_test_prompt' => '生成小猫图片',
    'dynamic_model_config_invalid' => '动态模型配置无效',
    'dynamic_model_sub_models_empty' => '动态模型子模型列表为空',
    'insufficient_permission_for_model' => '当前套餐不支持该智能模型',
    // 服务商名称国际化（key 使用枚举的 value）
    'provider_name' => [
        'Official' => 'Magic',
        'MicrosoftAzure' => 'Microsoft Azure',
        'Google-Image' => 'Google',
        'Gemini' => 'Google',
        'AWSBedrock' => 'Amazon Bedrock',
        'TTAPI' => 'OpenRouter',
        'DashScope' => '阿里云(百炼)',
        'Volcengine' => '火山引擎',
        'VolcengineArk' => '火山引擎',
        'DeepSeek' => 'DeepSeek',
        'MiracleVision' => '美图奇想',
        'Qwen' => '阿里云 (百炼)',
        'OpenAI' => '自定义提供商',
    ],
    'provider' => [
        'service_provider_config_id' => [
            'string' => '服务商配置ID必须为字符串',
        ],
        'provider_code' => [
            'required_without' => '请填写服务商编码',
            'string' => '服务商编码必须为字符串',
        ],
        'service_provider_config' => [
            'required_without' => '请填写服务商配置',
            'array' => '服务商配置必须为对象',
        ],
        'category' => [
            'required_without' => '请选择分类',
            'string' => '分类必须为字符串',
        ],
        'model_version' => [
            'required' => '请填写模型版本',
            'string' => '模型版本必须为字符串',
        ],
    ],
];
