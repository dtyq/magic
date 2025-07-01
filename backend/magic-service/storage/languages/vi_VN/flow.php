<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'error' => [
        'common' => 'Lỗi thông thường',
        'common_validate_failed' => 'Xác thực tham số chung không thành công',
        'common_business_exception' => 'Ngoại lệ kinh doanh thông thường',
        'flow_node_validate_failed' => 'Xác thực tham số nút không thành công',
        'message_error' => 'Lỗi tin nhắn thông thường',
        'execute_failed' => 'Thực thi thông thường không thành công',
        'execute_validate_failed' => 'Xác thực thực thi thông thường không thành công',
        'knowledge_validate_failed' => 'Xác thực cơ sở kiến thức không thành công',
        'access_denied' => 'Truy cập bị từ chối',
    ],
    'system' => [
        'uid_not_found' => 'Không tìm thấy uid người dùng',
        'unknown_authorization_type' => 'Loại ủy quyền không xác định',
        'unknown_node_params_config' => ':label Cấu hình nút không xác định',
    ],
    'common' => [
        'not_found' => 'Không tìm thấy :label',
        'empty' => ':label không thể trống',
        'repeat' => ':label lặp lại',
        'exist' => ':label đã tồn tại',
        'invalid' => ':label không hợp lệ',
    ],
    'organization_code' => [
        'empty' => 'Mã tổ chức không thể trống',
    ],
    'knowledge_code' => [
        'empty' => 'Mã kiến thức không thể trống',
    ],
    'flow_code' => [
        'empty' => 'Mã luồng không thể trống',
    ],
    'flow_entity' => [
        'empty' => 'Thực thể luồng không thể trống',
    ],
    'name' => [
        'empty' => 'Tên không thể trống',
    ],
    'branches' => [
        'empty' => 'Nhánh không thể trống',
    ],
    'conversation_id' => [
        'empty' => 'ID hội thoại không thể trống',
    ],
    'creator' => [
        'empty' => 'Người vận hành không thể trống',
    ],
    'model' => [
        'empty' => 'Mô hình không thể trống',
        'not_found' => '[:model_name] Không tìm thấy mô hình',
        'disabled' => 'Mô hình [:model_name] bị vô hiệu hóa',
        'not_support_embedding' => '[:model_name] không hỗ trợ nhúng',
        'error_config_missing' => 'Thiếu mục cấu hình :name. Vui lòng kiểm tra cài đặt hoặc liên hệ quản trị viên.',
        'embedding_failed' => '[:model_name] Nhúng thất bại, vui lòng kiểm tra cấu hình nhúng',
        'vector_size_not_match' => '[:model_name] Kích thước vector không khớp, vui lòng kiểm tra kích thước vector',
    ],
    'knowledge_base' => [
        're_vectorized_not_support' => 'Không hỗ trợ tái vector hóa',
    ],
    'max_record' => [
        'positive_integer' => 'Số lượng bản ghi tối đa phải là số nguyên dương từ :min đến :max',
    ],
    'nodes' => [
        'empty' => 'Không có nút nào',
    ],
    'node_id' => [
        'empty' => 'ID nút không thể trống',
    ],
    'node_type' => [
        'empty' => 'Loại nút không thể trống',
        'unsupported' => 'Loại nút không được hỗ trợ',
    ],
    'tool_set' => [
        'not_edit_default_tool_set' => 'Không thể chỉnh sửa bộ công cụ mặc định',
    ],
    'node' => [
        'empty' => 'Nút không thể trống',
        'execute_num_limit' => 'Số lần thực thi nút [:name] vượt quá giới hạn tối đa',
        'duplication_node_id' => 'ID nút[:node_id] bị trùng lặp',
        'single_debug_not_support' => 'Không hỗ trợ gỡ lỗi điểm đơn',
        'cache_key' => [
            'empty' => 'Khóa bộ nhớ đệm không thể trống',
            'string_only' => 'Khóa bộ nhớ đệm phải là chuỗi',
        ],
        'cache_value' => [
            'empty' => 'Giá trị bộ nhớ đệm không thể trống',
            'string_only' => 'Giá trị bộ nhớ đệm phải là chuỗi',
        ],
        'cache_ttl' => [
            'empty' => 'Thời gian bộ nhớ đệm không thể trống',
            'int_only' => 'Thời gian bộ nhớ đệm phải là số nguyên dương',
        ],
        'code' => [
            'empty' => 'Mã không thể trống',
            'empty_language' => 'Ngôn ngữ mã không thể trống',
            'unsupported_code_language' => '[:language] Ngôn ngữ mã không được hỗ trợ',
            'execute_failed' => 'Thực thi mã không thành công | :error',
            'execution_error' => 'Lỗi thực thi mã: :error',
        ],
        'http' => [
            'api_request_fail' => 'Yêu cầu API không thành công | :error',
            'output_error' => 'Lỗi đầu ra API | :error',
        ],
        'intent' => [
            'empty' => 'Ý định không thể trống',
            'title_empty' => 'Tiêu đề không thể trống',
            'desc_empty' => 'Mô tả không thể trống',
        ],
        'knowledge_fragment_store' => [
            'knowledge_code_empty' => 'Mã kiến thức không thể trống',
            'content_empty' => 'Đoạn văn bản không thể trống',
        ],
        'knowledge_similarity' => [
            'knowledge_codes_empty' => 'Mã kiến thức không thể trống',
            'query_empty' => 'Nội dung tìm kiếm không thể trống',
            'limit_valid' => 'Số lượng phải là số nguyên dương từ :min đến :max',
            'score_valid' => 'Điểm phải là số thập phân từ 0 đến 1',
        ],
        'llm' => [
            'tools_execute_failed' => 'Thực thi công cụ không thành công | :error',
        ],
        'loop' => [
            'relation_id_empty' => 'ID thân vòng lặp liên quan không thể trống',
            'origin_flow_not_found' => '[:label] Không tìm thấy luồng',
            'count_format_error' => 'Số lần lặp phải là số nguyên dương',
            'array_format_error' => 'Mảng lặp phải là một mảng',
            'max_loop_count_format_error' => 'Số lần duyệt tối đa phải là số nguyên dương từ :min đến :max',
            'loop_flow_execute_failed' => 'Thực thi thân vòng lặp không thành công :error',
        ],
        'start' => [
            'only_one' => 'Chỉ có thể có một nút bắt đầu',
            'must_exist' => 'Nút bắt đầu phải tồn tại',
            'unsupported_trigger_type' => '[:trigger_type] Loại kích hoạt không được hỗ trợ',
            'unsupported_unit' => '[:unit] Đơn vị thời gian không được hỗ trợ',
            'content_empty' => 'Tin nhắn không thể trống',
            'unsupported_routine_type' => 'Loại thói quen không được hỗ trợ',
            'input_key_conflict' => 'Tên trường [:key] xung đột với trường dành riêng của hệ thống, vui lòng sử dụng tên khác',
            'json_schema_validation_failed' => 'Lỗi định dạng JSON Schema: :error',
        ],
        'sub' => [
            'flow_not_found' => 'Không tìm thấy luồng con [:flow_code]',
            'start_node_not_found' => 'Không tìm thấy nút bắt đầu của luồng con [:flow_code]',
            'end_node_not_found' => 'Không tìm thấy nút kết thúc của luồng con [:flow_code]',
            'execute_failed' => 'Thực thi luồng con [:flow_name] không thành công :error',
            'flow_id_empty' => 'ID luồng con không thể trống',
        ],
        'tool' => [
            'tool_id_empty' => 'ID công cụ không thể trống',
            'flow_not_found' => 'Không tìm thấy công cụ [:flow_code]',
            'start_node_not_found' => 'Không tìm thấy nút bắt đầu của công cụ [:flow_code]',
            'end_node_not_found' => 'Không tìm thấy nút kết thúc của công cụ [:flow_code]',
            'execute_failed' => 'Thực thi công cụ [:flow_name] không thành công :error',
        ],
        'end' => [
            'must_exist' => 'Nút kết thúc phải tồn tại',
        ],
        'text_embedding' => [
            'text_empty' => 'Văn bản không thể trống',
        ],
        'text_splitter' => [
            'text_empty' => 'Văn bản không thể trống',
        ],
        'variable' => [
            'name_empty' => 'Tên biến không thể trống',
            'name_invalid' => 'Tên biến chỉ có thể chứa chữ cái, số và dấu gạch dưới, và không thể bắt đầu bằng số',
            'value_empty' => 'Giá trị biến không thể trống',
            'value_format_error' => 'Lỗi định dạng giá trị biến',
            'variable_not_exist' => 'Biến [:var_name] không tồn tại',
            'variable_not_array' => 'Biến [:var_name] không phải là mảng',
            'element_list_empty' => 'Danh sách phần tử không thể trống',
        ],
        'message' => [
            'type_error' => 'Lỗi loại tin nhắn',
            'unsupported_message_type' => 'Loại tin nhắn không được hỗ trợ',
            'content_error' => 'Lỗi nội dung tin nhắn',
        ],
        'knowledge_fragment_remove' => [
            'metadata_business_id_empty' => 'Metadata hoặc ID kinh doanh không thể trống',
        ],
    ],
    'executor' => [
        'unsupported_node_type' => '[:node_type] Loại nút không được hỗ trợ',
        'has_circular_dependencies' => '[:label] Tồn tại phụ thuộc vòng',
        'unsupported_trigger_type' => 'Loại kích hoạt không được hỗ trợ',
        'unsupported_flow_type' => 'Loại luồng không được hỗ trợ',
        'node_execute_count_reached' => 'Đã đạt số lần thực thi nút toàn cục tối đa (:max_count)',
    ],
    'component' => [
        'format_error' => '[:label] Lỗi định dạng',
    ],
    'fields' => [
        'flow_name' => 'Tên Luồng',
        'flow_type' => 'Loại Luồng',
        'organization_code' => 'Mã Tổ Chức',
        'creator' => 'Người Tạo',
        'creator_uid' => 'UID Người Tạo',
        'tool_name' => 'Tên Công Cụ',
        'tool_description' => 'Mô Tả Công Cụ',
        'nodes' => 'Danh Sách Nút',
        'node' => 'Nút',
        'api_key' => 'Khóa API',
        'api_key_name' => 'Tên Khóa API',
        'test_case_name' => 'Tên Trường Hợp Kiểm Thử',
        'flow_code' => 'Mã Luồng',
        'created_at' => 'Thời Gian Tạo',
        'case_config' => 'Cấu Hình Kiểm Thử',
        'nickname' => 'Biệt Danh',
        'chat_time' => 'Thời Gian Trò Chuyện',
        'message_type' => 'Loại Tin Nhắn',
        'content' => 'Nội Dung',
        'open_time' => 'Thời Gian Mở',
        'trigger_type' => 'Loại Kích Hoạt',
        'message_id' => 'ID Tin Nhắn',
        'type' => 'Loại',
        'analysis_result' => 'Kết Quả Phân Tích',
        'model_name' => 'Tên Mô Hình',
        'implementation' => 'Thực Hiện',
        'vector_size' => 'Kích Thước Vector',
        'conversation_id' => 'ID Hội Thoại',
        'modifier' => 'Người Sửa Đổi',
    ],
];
