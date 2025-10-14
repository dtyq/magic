<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'error' => [
        'common' => 'Common error',
        'common_validate_failed' => 'Common parameter validation failed',
        'common_business_exception' => 'Common business exception',
        'flow_node_validate_failed' => 'Node parameter validation failed',
        'message_error' => 'Common message error',
        'execute_failed' => 'Common execution failed',
        'execute_validate_failed' => 'Common execution validation failed',
        'knowledge_validate_failed' => 'Knowledge base validation failed',
        'access_denied' => 'Access denied',
    ],
    'system' => [
        'uid_not_found' => 'User uid is missing',
        'unknown_authorization_type' => 'Unknown authorization type',
        'unknown_node_params_config' => ':label Unknown node configuration',
    ],
    'common' => [
        'not_found' => ':label not found',
        'empty' => ':label cannot be empty',
        'repeat' => ':label repeat',
        'exist' => ':label is already exist',
        'invalid' => ':label is invalid',
    ],
    'organization_code' => [
        'empty' => 'Organization code cannot be empty',
    ],
    'knowledge_code' => [
        'empty' => 'Knowledge code cannot be empty',
    ],
    'flow_code' => [
        'empty' => 'Flow code cannot be empty',
    ],
    'flow_entity' => [
        'empty' => 'Flow entity cannot be empty',
    ],
    'name' => [
        'empty' => 'Name cannot be empty',
    ],
    'branches' => [
        'empty' => 'Branches cannot be empty',
    ],
    'conversation_id' => [
        'empty' => 'Conversation ID cannot be empty',
    ],
    'creator' => [
        'empty' => 'Operator cannot be empty',
    ],
    'model' => [
        'empty' => 'Model cannot be empty',
        'not_found' => '[:model_name] Model not found',
        'disabled' => 'Model [:model_name] is disabled',
        'not_support_embedding' => '[:model_name] does not support embedding',
        'error_config_missing' => 'Configuration item :name is missing. Please check the settings or contact the administrator.',
        'embedding_failed' => '[:model_name] embedding failed, error message: [:error_message], please check the embedding configuration',
        'vector_size_not_match' => '[:model_name] vector size does not match, expected size: [:expected_size], actual size: [:actual_size], please check the vector size',
    ],
    'knowledge_base' => [
        're_vectorized_not_support' => 'Re-vectorization is not supported',
    ],
    'max_record' => [
        'positive_integer' => 'Maximum record number must be a positive integer between :min and :max',
    ],
    'nodes' => [
        'empty' => 'There are no nodes',
    ],
    'node_id' => [
        'empty' => 'Node ID cannot be empty',
    ],
    'node_type' => [
        'empty' => 'Node type cannot be empty',
        'unsupported' => 'Unsupported node type',
    ],
    'tool_set' => [
        'not_edit_default_tool_set' => 'Cannot edit the default tool set',
    ],
    'node' => [
        'empty' => 'Node cannot be empty',
        'execute_num_limit' => 'Node [:name] execution count exceeds the maximum limit',
        'duplication_node_id' => 'Node ID[:node_id] is repeat',
        'single_debug_not_support' => 'Single point debugging is not supported',
        'cache_key' => [
            'empty' => 'Cache key cannot be empty',
            'string_only' => 'Cache key must be a string',
        ],
        'cache_value' => [
            'empty' => 'Cache value cannot be empty',
            'string_only' => 'Cache value must be a string',
        ],
        'cache_ttl' => [
            'empty' => 'Cache time cannot be empty',
            'int_only' => 'Cache time must be a positive integer',
        ],
        'code' => [
            'empty' => 'Code cannot be empty',
            'empty_language' => 'Code language cannot be empty',
            'unsupported_code_language' => '[:language] Unsupported code language',
            'execute_failed' => 'Code execution failed | :error',
            'execution_error' => 'Code execution error: :error',
        ],
        'http' => [
            'api_request_fail' => 'API request failed | :error',
            'output_error' => 'API output error | :error',
        ],
        'intent' => [
            'empty' => 'Intent cannot be empty',
            'title_empty' => 'Title cannot be empty',
            'desc_empty' => 'Description cannot be empty',
        ],
        'knowledge_fragment_store' => [
            'knowledge_code_empty' => 'Knowledge code cannot be empty',
            'content_empty' => 'Text fragment cannot be empty',
        ],
        'knowledge_similarity' => [
            'knowledge_codes_empty' => 'Knowledge code cannot be empty',
            'query_empty' => 'Search content cannot be empty',
            'limit_valid' => 'Quantity must be a positive integer between :min and :max',
            'score_valid' => 'Score must be a floating point number between 0 and 1',
        ],
        'llm' => [
            'tools_execute_failed' => 'Tool execution failed | :error',
        ],
        'loop' => [
            'relation_id_empty' => 'Related loop body ID cannot be empty',
            'origin_flow_not_found' => '[:label] Flow not found',
            'count_format_error' => 'Count loop must be a positive integer',
            'array_format_error' => 'Loop array must be an array',
            'max_loop_count_format_error' => 'Maximum traversal count must be a positive integer between :min and :max',
            'loop_flow_execute_failed' => 'Loop body execution failed :error',
        ],
        'start' => [
            'only_one' => 'There can only be one start node',
            'must_exist' => 'Start node must exist',
            'unsupported_trigger_type' => '[:trigger_type] Unsupported trigger type',
            'unsupported_unit' => '[:unit] Unsupported time unit',
            'content_empty' => 'Message cannot be empty',
            'unsupported_routine_type' => 'Unsupported routine type',
            'input_key_conflict' => 'Field name [:key] conflicts with system reserved field, please use a different name',
            'json_schema_validation_failed' => 'JSON Schema format error: :error',
        ],
        'sub' => [
            'flow_not_found' => 'SubFlow [:flow_code] not found',
            'start_node_not_found' => 'SubFlow [:flow_code] start node not found',
            'end_node_not_found' => 'SubFlow [:flow_code] end node not found',
            'execute_failed' => 'SubFlow [:flow_name] execution failed :error',
            'flow_id_empty' => 'SubFlow ID cannot be empty',
        ],
        'tool' => [
            'tool_id_empty' => 'Tool ID cannot be empty',
            'flow_not_found' => 'Tool [:flow_code] not found',
            'start_node_not_found' => 'Tool [:flow_code] start node not found',
            'end_node_not_found' => 'Tool [:flow_code] end node not found',
            'execute_failed' => 'Tool [:flow_name] execution failed :error',
            'name' => [
                'invalid_format' => 'Tool name can only contain letters, numbers, and underscores',
            ],
        ],
        'end' => [
            'must_exist' => 'End node must exist',
        ],
        'text_embedding' => [
            'text_empty' => 'Text cannot be empty',
        ],
        'text_splitter' => [
            'text_empty' => 'Text cannot be empty',
        ],
        'variable' => [
            'name_empty' => 'Variable name cannot be empty',
            'name_invalid' => 'Variable name can only contain letters, numbers, and underscores, and cannot start with a number',
            'value_empty' => 'Variable value cannot be empty',
            'value_format_error' => 'Variable value format error',
            'variable_not_exist' => 'Variable [:var_name] does not exist',
            'variable_not_array' => 'Variable [:var_name] is not an array',
            'element_list_empty' => 'Element list cannot be empty',
        ],
        'message' => [
            'type_error' => 'Message type error',
            'unsupported_message_type' => 'Unsupported message type',
            'content_error' => 'Message content error',
        ],
        'knowledge_fragment_remove' => [
            'metadata_business_id_empty' => 'Metadata or business ID cannot be empty',
        ],
    ],
    'executor' => [
        'unsupported_node_type' => '[:node_type] Unsupported node type',
        'has_circular_dependencies' => '[:label] Circular dependencies exist',
        'unsupported_trigger_type' => 'Unsupported trigger type',
        'unsupported_flow_type' => 'Unsupported flow type',
        'node_execute_count_reached' => 'Maximum global node execution count (:max_count) reached',
    ],
    'component' => [
        'format_error' => '[:label] Format error',
    ],
    'export' => [
        'not_main_flow' => 'Export flow failed: [:label] is not a main flow',
        'circular_dependency_detected' => 'Export flow failed: Circular dependency detected',
    ],
    'import' => [
        'missing_main_flow' => 'Import flow failed: Missing main flow data',
        'missing_import_data' => 'Import flow failed: Missing import data',
        'main_flow_failed' => 'Import main flow failed: :error',
        'failed' => 'Import flow [:label] failed',
        'tool_set_failed' => 'Import tool set [:name] failed: :error',
        'tool_flow_failed' => 'Import tool flow [:name] failed: :error',
        'sub_flow_failed' => 'Import sub flow [:name] failed: :error',
        'associate_agent_failed' => 'Associate agent failed: :error',
        'missing_data' => 'Import flow failed: Missing agent or flow data',
    ],
    'fields' => [
        'flow_name' => 'Flow Name',
        'flow_type' => 'Flow Type',
        'organization_code' => 'Organization Code',
        'creator' => 'Creator',
        'creator_uid' => 'Creator UID',
        'tool_name' => 'Tool Name',
        'tool_description' => 'Tool Description',
        'nodes' => 'Node List',
        'node' => 'Node',
        'api_key' => 'API Key',
        'api_key_name' => 'API Key Name',
        'test_case_name' => 'Test Case Name',
        'flow_code' => 'Flow Code',
        'created_at' => 'Created Time',
        'case_config' => 'Test Configuration',
        'nickname' => 'Nickname',
        'chat_time' => 'Chat Time',
        'message_type' => 'Message Type',
        'content' => 'Content',
        'open_time' => 'Open Time',
        'trigger_type' => 'Trigger Type',
        'message_id' => 'Message ID',
        'type' => 'Type',
        'analysis_result' => 'Analysis Result',
        'model_name' => 'Model Name',
        'implementation' => 'Implementation',
        'vector_size' => 'Vector Size',
        'conversation_id' => 'Conversation ID',
        'modifier' => 'Modifier',
    ],
    'cache' => [
        'validation_failed' => 'Cache validation failed',
        'not_found' => 'Cache not found',
        'expired' => 'Cache expired',
        'operation_failed' => 'Cache operation failed',
        'cache_prefix' => [
            'empty' => 'Cache prefix cannot be empty',
            'too_long' => 'Cache prefix cannot exceed {max} characters',
        ],
        'cache_key' => [
            'empty' => 'Cache key cannot be empty',
            'too_long' => 'Cache key cannot exceed {max} characters',
        ],
        'cache_key_hash' => [
            'invalid_length' => 'Cache key hash must be exactly {expected} characters',
        ],
        'scope_tag' => [
            'empty' => 'Scope tag cannot be empty',
            'too_long' => 'Scope tag cannot exceed {max} characters',
        ],
        'organization_code' => [
            'empty' => 'Organization code cannot be empty',
            'too_long' => 'Organization code cannot exceed {max} characters',
        ],
        'ttl' => [
            'invalid_range' => 'TTL seconds must be between {min} and {max} (-1/0/null for permanent cache)',
        ],
        'creator' => [
            'too_long' => 'Creator cannot exceed {max} characters',
        ],
        'modifier' => [
            'too_long' => 'Modifier cannot exceed {max} characters',
        ],
        'extend' => [
            'negative_seconds' => 'Additional seconds cannot be negative',
            'exceeds_maximum' => 'Extended TTL would exceed maximum value {max}',
        ],
        'id' => [
            'invalid' => 'ID must be a positive integer, got: {id}',
        ],
        'prefix' => [
            'invalid_format' => 'Invalid cache prefix format',
        ],
    ],
];
