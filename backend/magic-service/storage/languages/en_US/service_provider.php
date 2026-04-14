<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'system_error' => 'System error',
    'model_not_found' => 'Model not found',
    'invalid_model_type' => 'Invalid model type',
    'service_provider_not_found' => 'Service provider not found',
    'service_provider_config_error' => 'Service provider configuration error',
    'request_failed' => 'Request failed',
    'response_parse_error' => 'Response parsing error',
    'quota_exceeded' => 'Quota exceeded',
    'invalid_parameter' => 'Invalid parameter',
    'model_not_active' => 'Model not activated',
    'service_provider_not_active' => 'Service provider not activated',
    'model_name_required' => 'Model name is required',
    'model_type_required' => 'Model type is required',
    'add_provider_failed' => 'Failed to add service provider',
    'delete_provider_failed' => 'Failed to delete service provider',
    'provider_no_model_list' => 'This service provider cannot get model list',
    'init_organization_providers_failed' => 'Init service provider failed',
    'original_model_already_exists' => 'Original model already exists',
    'load_balancing_weight_range_error' => 'Load balancing weight must be between 0 and 100',
    'model_officially_disabled' => 'Model has been officially disabled',
    'magic_provider_not_found' => 'Magic service provider configuration not found',
    'original_model_id_already_exists' => 'Original model ID already exists',
    'original_model_id_already_exists_in_group' => 'The dynamic model configuration already exists in group ":group_name": :model_label. Please edit the existing model directly',
    'original_model_not_found' => 'Original model not found',
    'invalid_pricing' => 'Pricing cannot be less than 0',
    'creativity_temperature_conflict' => 'creativity and temperature cannot be set at the same time',
    'creativity_value_range_error' => 'creativity value must be between 0-2',
    'temperature_value_range_error' => 'temperature value must be between 0-2',
    'ai_ability_not_found' => 'AI ability not found',
    'ai_ability_disabled' => 'AI ability is not enabled',
    'config_disabled' => 'Service provider configuration is disabled',
    'config_not_found' => 'Service provider configuration not found',
    'config_load_failed' => 'Configuration loading failed',
    'connectivity_test_prompt' => 'Generate a picture of a kitten',
    'dynamic_model_config_invalid' => 'Dynamic model configuration is invalid',
    'dynamic_model_sub_models_empty' => 'Dynamic model sub-models list is empty',
    'insufficient_permission_for_model' => 'Current subscription does not support this intelligent model',
    // Service provider name i18n (key uses enum value)
    'provider_name' => [
        'Official' => 'Magic',
        'MicrosoftAzure' => 'Microsoft Azure',
        'Google-Image' => 'Google',
        'Gemini' => 'Google',
        'AWSBedrock' => 'Amazon Bedrock',
        'TTAPI' => 'OpenRouter',
        'DashScope' => 'Aliyun (Bailian)',
        'Volcengine' => 'Volcengine',
        'VolcengineArk' => 'Volcengine',
        'DeepSeek' => 'DeepSeek',
        'MiracleVision' => 'MiracleVision',
        'Qwen' => 'Amazon Bedrock',
        'OpenAI' => 'Custom Provider',
    ],
    'provider' => [
        'service_provider_config_id' => [
            'string' => 'Service provider config ID must be a string',
        ],
        'provider_code' => [
            'required_without' => 'Please provide provider code',
            'string' => 'Provider code must be a string',
        ],
        'service_provider_config' => [
            'required_without' => 'Please provide service provider config',
            'array' => 'Service provider config must be an object',
        ],
        'category' => [
            'required_without' => 'Please select a category',
            'string' => 'Category must be a string',
        ],
        'model_version' => [
            'required' => 'Please provide model version',
            'string' => 'Model version must be a string',
        ],
    ],
];
