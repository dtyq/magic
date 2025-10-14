<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'error' => [
        'common' => 'ข้อผิดพลาดทั่วไป',
        'common_validate_failed' => 'การตรวจสอบพารามิเตอร์ทั่วไปล้มเหลว',
        'common_business_exception' => 'ข้อยกเว้นทางธุรกิจทั่วไป',
        'flow_node_validate_failed' => 'การตรวจสอบพารามิเตอร์โหนดล้มเหลว',
        'message_error' => 'ข้อผิดพลาดข้อความทั่วไป',
        'execute_failed' => 'การดำเนินการทั่วไปล้มเหลว',
        'execute_validate_failed' => 'การตรวจสอบการดำเนินการทั่วไปล้มเหลว',
        'knowledge_validate_failed' => 'การตรวจสอบฐานความรู้ล้มเหลว',
        'access_denied' => 'การเข้าถึงถูกปฏิเสธ',
    ],
    'system' => [
        'uid_not_found' => 'ไม่พบรหัสผู้ใช้',
        'unknown_authorization_type' => 'ประเภทการอนุญาตที่ไม่รู้จัก',
        'unknown_node_params_config' => ':label การกำหนดค่าโหนดที่ไม่รู้จัก',
    ],
    'common' => [
        'not_found' => 'ไม่พบ :label',
        'empty' => ':label ต้องไม่ว่างเปล่า',
        'repeat' => ':label ซ้ำกัน',
        'exist' => ':label มีอยู่แล้ว',
        'invalid' => ':label ไม่ถูกต้อง',
    ],
    'organization_code' => [
        'empty' => 'รหัสองค์กรต้องไม่ว่างเปล่า',
    ],
    'knowledge_code' => [
        'empty' => 'รหัสความรู้ต้องไม่ว่างเปล่า',
    ],
    'flow_code' => [
        'empty' => 'รหัสโฟลว์ต้องไม่ว่างเปล่า',
    ],
    'flow_entity' => [
        'empty' => 'เอนทิตีโฟลว์ต้องไม่ว่างเปล่า',
    ],
    'name' => [
        'empty' => 'ชื่อต้องไม่ว่างเปล่า',
    ],
    'branches' => [
        'empty' => 'สาขาต้องไม่ว่างเปล่า',
    ],
    'conversation_id' => [
        'empty' => 'รหัสการสนทนาต้องไม่ว่างเปล่า',
    ],
    'creator' => [
        'empty' => 'ผู้ดำเนินการต้องไม่ว่างเปล่า',
    ],
    'model' => [
        'empty' => 'โมเดลต้องไม่ว่างเปล่า',
        'not_found' => 'ไม่พบโมเดล [:model_name]',
        'disabled' => 'โมเดล [:model_name] ถูกปิดใช้งาน',
        'not_support_embedding' => '[:model_name] ไม่รองรับการฝังตัว',
        'error_config_missing' => 'ไม่พบรายการกำหนดค่า :name โปรดตรวจสอบการตั้งค่าหรือติดต่อผู้ดูแลระบบ',
        'embedding_failed' => '[:model_name] การฝังตัวล้มเหลว, ข้อความผิดพลาด: [:error_message], โปรดตรวจสอบการตั้งค่าฝังตัว',
        'vector_size_not_match' => '[:model_name] ขนาดเวกเตอร์ไม่ตรงกับการตั้งค่า, ขนาดที่คาดหวัง: [:expected_size], ขนาดจริง: [:actual_size], โปรดตรวจสอบขนาดเวกเตอร์',
    ],
    'knowledge_base' => [
        're_vectorized_not_support' => 'ไม่รองรับการสร้างเวกเตอร์ใหม่',
    ],
    'max_record' => [
        'positive_integer' => 'จำนวนบันทึกสูงสุดต้องเป็นจำนวนเต็มบวกระหว่าง :min และ :max',
    ],
    'nodes' => [
        'empty' => 'ไม่มีโหนด',
    ],
    'node_id' => [
        'empty' => 'รหัสโหนดต้องไม่ว่างเปล่า',
    ],
    'node_type' => [
        'empty' => 'ประเภทโหนดต้องไม่ว่างเปล่า',
        'unsupported' => 'ประเภทโหนดไม่รองรับ',
    ],
    'tool_set' => [
        'not_edit_default_tool_set' => 'ไม่สามารถแก้ไขชุดเครื่องมือเริ่มต้นได้',
    ],
    'node' => [
        'empty' => 'โหนดต้องไม่ว่างเปล่า',
        'execute_num_limit' => 'จำนวนการดำเนินการของโหนด [:name] เกินขีดจำกัดสูงสุด',
        'duplication_node_id' => 'รหัสโหนด[:node_id] ซ้ำกัน',
        'single_debug_not_support' => 'ไม่รองรับการดีบักเฉพาะจุด',
        'cache_key' => [
            'empty' => 'คีย์แคชต้องไม่ว่างเปล่า',
            'string_only' => 'คีย์แคชต้องเป็นสตริง',
        ],
        'cache_value' => [
            'empty' => 'ค่าแคชต้องไม่ว่างเปล่า',
            'string_only' => 'ค่าแคชต้องเป็นสตริง',
        ],
        'cache_ttl' => [
            'empty' => 'เวลาแคชต้องไม่ว่างเปล่า',
            'int_only' => 'เวลาแคชต้องเป็นจำนวนเต็มบวก',
        ],
        'code' => [
            'empty' => 'โค้ดต้องไม่ว่างเปล่า',
            'empty_language' => 'ภาษาโค้ดต้องไม่ว่างเปล่า',
            'unsupported_code_language' => '[:language] ภาษาโค้ดไม่รองรับ',
            'execute_failed' => 'การดำเนินการโค้ดล้มเหลว | :error',
            'execution_error' => 'ข้อผิดพลาดการดำเนินการโค้ด: :error',
        ],
        'http' => [
            'api_request_fail' => 'การร้องขอ API ล้มเหลว | :error',
            'output_error' => 'ข้อผิดพลาดเอาต์พุต API | :error',
        ],
        'intent' => [
            'empty' => 'เจตนาต้องไม่ว่างเปล่า',
            'title_empty' => 'ชื่อเรื่องต้องไม่ว่างเปล่า',
            'desc_empty' => 'คำอธิบายต้องไม่ว่างเปล่า',
        ],
        'knowledge_fragment_store' => [
            'knowledge_code_empty' => 'รหัสความรู้ต้องไม่ว่างเปล่า',
            'content_empty' => 'ส่วนข้อความต้องไม่ว่างเปล่า',
        ],
        'knowledge_similarity' => [
            'knowledge_codes_empty' => 'รหัสความรู้ต้องไม่ว่างเปล่า',
            'query_empty' => 'เนื้อหาการค้นหาต้องไม่ว่างเปล่า',
            'limit_valid' => 'จำนวนต้องเป็นจำนวนเต็มบวกระหว่าง :min และ :max',
            'score_valid' => 'คะแนนต้องเป็นเลขทศนิยมระหว่าง 0 และ 1',
        ],
        'llm' => [
            'tools_execute_failed' => 'การดำเนินการเครื่องมือล้มเหลว | :error',
        ],
        'loop' => [
            'relation_id_empty' => 'รหัสบอดี้ลูปที่เกี่ยวข้องต้องไม่ว่างเปล่า',
            'origin_flow_not_found' => 'ไม่พบโฟลว์ [:label]',
            'count_format_error' => 'จำนวนลูปต้องเป็นจำนวนเต็มบวก',
            'array_format_error' => 'อาร์เรย์ลูปต้องเป็นอาร์เรย์',
            'max_loop_count_format_error' => 'จำนวนการเข้าถึงสูงสุดต้องเป็นจำนวนเต็มบวกระหว่าง :min และ :max',
            'loop_flow_execute_failed' => 'การดำเนินการบอดี้ลูปล้มเหลว :error',
        ],
        'start' => [
            'only_one' => 'ต้องมีโหนดเริ่มต้นเพียงหนึ่งเดียว',
            'must_exist' => 'โหนดเริ่มต้นต้องมีอยู่',
            'unsupported_trigger_type' => '[:trigger_type] ประเภททริกเกอร์ไม่รองรับ',
            'unsupported_unit' => '[:unit] หน่วยเวลาไม่รองรับ',
            'content_empty' => 'ข้อความต้องไม่ว่างเปล่า',
            'unsupported_routine_type' => 'ประเภทรูทีนไม่รองรับ',
            'input_key_conflict' => 'ชื่อฟิลด์ [:key] ขัดแย้งกับฟิลด์สงวนของระบบ โปรดใช้ชื่ออื่น',
            'json_schema_validation_failed' => 'ข้อผิดพลาดรูปแบบ JSON Schema: :error',
        ],
        'sub' => [
            'flow_not_found' => 'ไม่พบซับโฟลว์ [:flow_code]',
            'start_node_not_found' => 'ไม่พบโหนดเริ่มต้นของซับโฟลว์ [:flow_code]',
            'end_node_not_found' => 'ไม่พบโหนดสิ้นสุดของซับโฟลว์ [:flow_code]',
            'execute_failed' => 'การดำเนินการซับโฟลว์ [:flow_name] ล้มเหลว :error',
            'flow_id_empty' => 'รหัสซับโฟลว์ต้องไม่ว่างเปล่า',
        ],
        'tool' => [
            'tool_id_empty' => 'รหัสเครื่องมือต้องไม่ว่างเปล่า',
            'flow_not_found' => 'ไม่พบเครื่องมือ [:flow_code]',
            'start_node_not_found' => 'ไม่พบโหนดเริ่มต้นของเครื่องมือ [:flow_code]',
            'end_node_not_found' => 'ไม่พบโหนดสิ้นสุดของเครื่องมือ [:flow_code]',
            'execute_failed' => 'การดำเนินการเครื่องมือ [:flow_name] ล้มเหลว :error',
            'name' => [
                'invalid_format' => 'ชื่อเครื่องมือสามารถมีเฉพาะตัวอักษร ตัวเลข และขีดใต้เท่านั้น',
            ],
        ],
        'end' => [
            'must_exist' => 'โหนดสิ้นสุดต้องมีอยู่',
        ],
        'text_embedding' => [
            'text_empty' => 'ข้อความต้องไม่ว่างเปล่า',
        ],
        'text_splitter' => [
            'text_empty' => 'ข้อความต้องไม่ว่างเปล่า',
        ],
        'variable' => [
            'name_empty' => 'ชื่อตัวแปรต้องไม่ว่างเปล่า',
            'name_invalid' => 'ชื่อตัวแปรต้องประกอบด้วยตัวอักษร ตัวเลข และขีดล่างเท่านั้น และต้องไม่ขึ้นต้นด้วยตัวเลข',
            'value_empty' => 'ค่าตัวแปรต้องไม่ว่างเปล่า',
            'value_format_error' => 'ข้อผิดพลาดรูปแบบค่าตัวแปร',
            'variable_not_exist' => 'ตัวแปร [:var_name] ไม่มีอยู่',
            'variable_not_array' => 'ตัวแปร [:var_name] ไม่ใช่อาร์เรย์',
            'element_list_empty' => 'รายการองค์ประกอบต้องไม่ว่างเปล่า',
        ],
        'message' => [
            'type_error' => 'ข้อผิดพลาดประเภทข้อความ',
            'unsupported_message_type' => 'ประเภทข้อความไม่รองรับ',
            'content_error' => 'ข้อผิดพลาดเนื้อหาข้อความ',
        ],
        'knowledge_fragment_remove' => [
            'metadata_business_id_empty' => 'เมตาดาต้าหรือรหัสธุรกิจต้องไม่ว่างเปล่า',
        ],
    ],
    'executor' => [
        'unsupported_node_type' => '[:node_type] ประเภทโหนดไม่รองรับ',
        'has_circular_dependencies' => '[:label] มีการพึ่งพาเป็นวงกลม',
        'unsupported_trigger_type' => 'ประเภททริกเกอร์ไม่รองรับ',
        'unsupported_flow_type' => 'ประเภทโฟลว์ไม่รองรับ',
        'node_execute_count_reached' => 'จำนวนการดำเนินการโหนดโกลบอลสูงสุด (:max_count) ถึงแล้ว',
    ],
    'component' => [
        'format_error' => '[:label] ข้อผิดพลาดรูปแบบ',
    ],
    'fields' => [
        'flow_name' => 'ชื่อโฟลว์',
        'flow_type' => 'ประเภทโฟลว์',
        'organization_code' => 'รหัสองค์กร',
        'creator' => 'ผู้สร้าง',
        'creator_uid' => 'รหัสผู้สร้าง',
        'tool_name' => 'ชื่อเครื่องมือ',
        'tool_description' => 'คำอธิบายเครื่องมือ',
        'nodes' => 'รายการโหนด',
        'node' => 'โหนด',
        'api_key' => 'คีย์ API',
        'api_key_name' => 'ชื่อคีย์ API',
        'test_case_name' => 'ชื่อกรณีทดสอบ',
        'flow_code' => 'รหัสโฟลว์',
        'created_at' => 'เวลาที่สร้าง',
        'case_config' => 'การกำหนดค่าการทดสอบ',
        'nickname' => 'ชื่อเล่น',
        'chat_time' => 'เวลาแชท',
        'message_type' => 'ประเภทข้อความ',
        'content' => 'เนื้อหา',
        'open_time' => 'เวลาเปิด',
        'trigger_type' => 'ประเภททริกเกอร์',
        'message_id' => 'รหัสข้อความ',
        'type' => 'ประเภท',
        'analysis_result' => 'ผลการวิเคราะห์',
        'model_name' => 'ชื่อโมเดล',
        'implementation' => 'การดำเนินการ',
        'vector_size' => 'ขนาดเวกเตอร์',
        'conversation_id' => 'รหัสการสนทนา',
        'modifier' => 'ผู้แก้ไข',
    ],
];
