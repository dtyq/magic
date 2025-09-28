<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'error' => [
        'common' => '通用错误',
        'common_validate_failed' => '通用参数验证失败',
        'common_business_exception' => '通用业务异常',
        'flow_node_validate_failed' => '节点参数验证失败',
        'message_error' => '通用消息错误',
        'execute_failed' => '通用执行失败',
        'execute_validate_failed' => '通用执行验证失败',
        'knowledge_validate_failed' => '知识库验证失败',
        'access_denied' => '访问被拒绝',
    ],
    'system' => [
        'uid_not_found' => '用户 uid 缺失',
        'unknown_authorization_type' => '未知的授权类型',
        'unknown_node_params_config' => ':label 未知的节点配置',
    ],
    'common' => [
        'not_found' => ':label 未找到',
        'empty' => ':label 不能为空',
        'repeat' => ':label 重复',
        'exist' => ':label 已存在',
        'invalid' => ':label 是无效的',
    ],
    'organization_code' => [
        'empty' => '组织代码 不能为空',
    ],
    'knowledge_code' => [
        'empty' => '知识库编码 不能为空',
    ],
    'content' => [
        'empty' => '内容 不能为空',
    ],
    'flow_code' => [
        'empty' => '流程代码 不能为空',
    ],
    'flow_entity' => [
        'empty' => '流程实体 不能为空',
    ],
    'name' => [
        'empty' => '名称 不能为空',
    ],
    'branches' => [
        'empty' => '分支 不能为空',
    ],
    'conversation_id' => [
        'empty' => '会话 ID 不能为空',
    ],
    'creator' => [
        'empty' => '操作人 不能为空',
    ],
    'model' => [
        'empty' => '模型 不能为空',
        'not_found' => '[:model_name] 模型不存在',
        'disabled' => '模型 [:model_name] 已禁用',
        'not_support_embedding' => '[:model_name] 不支持嵌入',
        'error_config_missing' => '配置项 :name 缺失，请检查相关设置或联系管理员处理。',
        'invalid_implementation_interface' => '实现必须是 :interface 的实例',
        'embedding_failed' => '[:model_name] 嵌入失败, 错误信息: [:error_message], 请检查嵌入配置',
        'vector_size_not_match' => '[:model_name] 向量大小不匹配, 期望大小: [:expected_size], 实际大小: [:actual_size], 请检查向量大小',
    ],
    'knowledge_base' => [
        're_vectorized_not_support' => '不支持重新向量化',
    ],
    'max_record' => [
        'positive_integer' => '最大记录数 只能是 :min - :max 的正整数',
    ],
    'nodes' => [
        'empty' => '没有任何节点',
    ],
    'node_id' => [
        'empty' => '节点 ID 不能为空',
    ],
    'node_type' => [
        'empty' => '节点类型 不能为空',
        'unsupported' => '不支持的节点类型',
    ],
    'node_input' => [
        'empty' => '节点[:label]输入 不能为空',
    ],
    'node_output' => [
        'empty' => '节点[:label]输出 不能为空',
    ],
    'tool_set' => [
        'not_edit_default_tool_set' => '不允许编辑默认工具集',
    ],
    'node' => [
        'empty' => '节点 不能为空',
        'execute_num_limit' => '节点[:name] 运行次数超过最大限制',
        'duplication_node_id' => '节点ID[:node_id] 重复',
        'single_debug_not_support' => '不支持单点调试',
        'cache_key' => [
            'empty' => '缓存键 不能为空',
            'string_only' => '缓存键 必须是字符串',
        ],
        'cache_value' => [
            'empty' => '缓存值 不能为空',
            'string_only' => '缓存值 必须是字符串',
        ],
        'cache_ttl' => [
            'empty' => '缓存时间 不能为空',
            'int_only' => '缓存时间 必须是正整数',
        ],
        'cannot_enable_empty_nodes' => '当前流程未设置任何节点，无法被启用',
        'validation_failed' => '节点[:node_id][:node_type] 验证失败: :error',
        'code' => [
            'empty' => '代码 不能为空',
            'empty_language' => '代码语言 不能为空',
            'unsupported_code_language' => '[:language] 不支持的代码语言',
            'execute_failed' => '代码执行失败 | :error',
            'execution_error' => '代码执行错误：:error',
        ],
        'http' => [
            'api_request_fail' => 'API 请求失败 | :error',
            'output_error' => '输出不规范 | :error',
        ],
        'intent' => [
            'empty' => '意图 不能为空',
            'title_empty' => '标题 不能为空',
            'desc_empty' => '描述 不能为空',
        ],
        'knowledge' => [
            'knowledge_code_empty' => '知识库编码 不能为空',
        ],
        'knowledge_fragment_store' => [
            'knowledge_code_empty' => '知识库编码 不能为空',
            'content_empty' => '文本片段 不能为空',
        ],
        'knowledge_similarity' => [
            'knowledge_codes_empty' => '知识库编码 不能为空',
            'query_empty' => '搜索内容 不能为空',
            'limit_valid' => '数量 只能是 :min - :max 之间的正整数',
            'score_valid' => '相似度 只能是 0-1 之间的小数',
        ],
        'llm' => [
            'tools_execute_failed' => '工具执行失败 | :error',
        ],
        'loop' => [
            'relation_id_empty' => '关联循环体 ID 不能为空',
            'origin_flow_not_found' => '[:label] 流程未找到',
            'count_format_error' => '计数循环 必须是正整数',
            'array_format_error' => '循环数组 必须是数组',
            'max_loop_count_format_error' => '最大遍历次数 只能填写 :min - :max 的正整数',
            'loop_flow_execute_failed' => '循环体执行失败 :error',
        ],
        'start' => [
            'only_one' => '开始节点 不能有多个',
            'must_exist' => '开始节点 必须存在',
            'unsupported_trigger_type' => '[:trigger_type] 不支持的触发方式',
            'unsupported_unit' => '[:unit] 不支持的时间单位',
            'content_empty' => '消息 不能为空',
            'interval_valid' => '间隔时间 必须为正整数',
            'unsupported_routine_type' => '不支持的周期类型',
            'input_key_conflict' => '字段名 [:key] 与系统保留字段冲突，请使用其他名称',
            'json_schema_validation_failed' => 'JSON Schema 格式错误：:error',
        ],
        'sub' => [
            'flow_not_found' => '子流程 [:flow_code] 未找到',
            'start_node_not_found' => '子流程[:flow_code] 开始节点未找到',
            'end_node_not_found' => '子流程[:flow_code] 结束节点未找到',
            'execute_failed' => '子流程[:flow_name] 执行失败 :error',
            'flow_id_empty' => '子流程ID 不能为空',
        ],
        'text_embedding' => [
            'text_empty' => '文本 不能为空',
        ],
        'text_splitter' => [
            'text_empty' => '文本 不能为空',
        ],
        'variable' => [
            'name_empty' => '变量名 不能为空',
            'name_invalid' => '变量名 仅可包含字母、数字、下划线，且不允许以数字开头',
            'value_empty' => '变量值 不能为空',
            'value_format_error' => '变量值 格式错误',
            'variable_not_exist' => '变量 [:var_name] 不存在',
            'variable_not_array' => '变量 [:var_name] 不是数组',
            'element_list_empty' => '元素列表 不能为空',
        ],
        'message' => [
            'type_error' => '消息类型错误',
            'unsupported_message_type' => '不支持的消息类型',
            'content_error' => '消息内容错误',
        ],
        'knowledge_fragment_remove' => [
            'metadata_business_id_empty' => '元数据或业务 ID 不能为空',
        ],
        'tool' => [
            'tool_id_empty' => '工具ID 不能为空',
            'flow_not_found' => '工具 [:flow_code] 未找到',
            'start_node_not_found' => '工具[:flow_code] 开始节点未找到',
            'end_node_not_found' => '工具[:flow_code] 结束节点未找到',
            'execute_failed' => '工具[:flow_name] 执行失败 :error',
            'name' => [
                'invalid_format' => '工具名称只能包含字母、数字、下划线',
            ],
        ],
    ],
    'executor' => [
        'unsupported_node_type' => '[:node_type] 不支持的节点类型',
        'has_circular_dependencies' => '[:label] 存在循环依赖',
        'unsupported_trigger_type' => '不支持的触发方式',
        'unsupported_flow_type' => '不支持的流程类型',
        'node_execute_count_reached' => '达到全局节点的最大运行次数（:max_count）',
    ],
    'component' => [
        'format_error' => '[:label] 格式错误',
    ],
    'export' => [
        'not_main_flow' => '导出流程失败：[:label] 不是主流程',
        'circular_dependency_detected' => '导出流程失败：检测到循环依赖关系',
    ],
    'import' => [
        'missing_main_flow' => '导入流程失败：缺少主流程数据',
        'missing_import_data' => '导入流程失败：缺少导入数据',
        'main_flow_failed' => '导入主流程失败：:error',
        'failed' => '导入流程 [:label] 失败',
        'tool_set_failed' => '导入工具集 [:name] 失败：:error',
        'tool_flow_failed' => '导入工具流程 [:name] 失败：:error',
        'sub_flow_failed' => '导入子流程 [:name] 失败：:error',
        'associate_agent_failed' => '关联助理失败：:error',
        'missing_data' => '导入流程失败：缺少助理或流程数据',
    ],
    'fields' => [
        'flow_name' => '流程名称',
        'flow_type' => '流程类型',
        'organization_code' => '组织编码',
        'creator' => '创建人',
        'creator_uid' => '创建人UID',
        'tool_name' => '工具名称',
        'tool_description' => '工具描述',
        'nodes' => '节点列表',
        'node' => '节点',
        'api_key' => 'API密钥',
        'api_key_name' => 'API密钥名称',
        'test_case_name' => '测试集名称',
        'flow_code' => '流程编码',
        'created_at' => '创建时间',
        'case_config' => '测试配置',
        'nickname' => '昵称',
        'chat_time' => '聊天时间',
        'message_type' => '消息类型',
        'content' => '内容',
        'open_time' => '打开时间',
        'trigger_type' => '触发类型',
        'message_id' => '消息ID',
        'type' => '类型',
        'analysis_result' => '分析结果',
        'model_name' => '模型名称',
        'implementation' => '实现方式',
        'vector_size' => '向量大小',
        'conversation_id' => '会话ID',
        'modifier' => '修改人',
    ],
    'cache' => [
        'validation_failed' => '缓存验证失败',
        'not_found' => '缓存不存在',
        'expired' => '缓存已过期',
        'operation_failed' => '缓存操作失败',
        'cache_prefix' => [
            'empty' => '缓存前缀不能为空',
            'too_long' => '缓存前缀不能超过{max}个字符',
        ],
        'cache_key' => [
            'empty' => '缓存键不能为空',
            'too_long' => '缓存键不能超过{max}个字符',
        ],
        'cache_key_hash' => [
            'invalid_length' => '缓存键哈希值长度必须为{expected}个字符',
        ],
        'scope_tag' => [
            'empty' => '作用域标识不能为空',
            'too_long' => '作用域标识不能超过{max}个字符',
        ],
        'organization_code' => [
            'empty' => '组织代码不能为空',
            'too_long' => '组织代码不能超过{max}个字符',
        ],
        'ttl' => [
            'invalid_range' => 'TTL秒数必须在{min}到{max}之间（-1/0/null代表永久缓存）',
        ],
        'creator' => [
            'too_long' => '创建人不能超过{max}个字符',
        ],
        'modifier' => [
            'too_long' => '更新人不能超过{max}个字符',
        ],
        'extend' => [
            'negative_seconds' => '扩展时间不能为负数',
            'exceeds_maximum' => '扩展后的TTL不能超过最大值{max}',
        ],
        'id' => [
            'invalid' => 'ID必须是正整数，当前值：{id}',
        ],
        'prefix' => [
            'invalid_format' => '缓存前缀格式无效',
        ],
    ],
];
