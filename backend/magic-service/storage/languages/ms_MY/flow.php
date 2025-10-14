<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'error' => [
        'common' => 'Ralat biasa',
        'common_validate_failed' => 'Pengesahan parameter umum gagal',
        'common_business_exception' => 'Pengecualian perniagaan umum',
        'flow_node_validate_failed' => 'Pengesahan parameter nod gagal',
        'message_error' => 'Ralat mesej umum',
        'execute_failed' => 'Pelaksanaan umum gagal',
        'execute_validate_failed' => 'Pengesahan pelaksanaan umum gagal',
        'knowledge_validate_failed' => 'Pengesahan pangkalan pengetahuan gagal',
        'access_denied' => 'Akses ditolak',
    ],
    'system' => [
        'uid_not_found' => 'UID pengguna hilang',
        'unknown_authorization_type' => 'Jenis kebenaran tidak diketahui',
        'unknown_node_params_config' => ':label Konfigurasi nod tidak diketahui',
    ],
    'common' => [
        'not_found' => ':label tidak dijumpai',
        'empty' => ':label tidak boleh kosong',
        'repeat' => ':label berulang',
        'exist' => ':label sudah wujud',
        'invalid' => ':label tidak sah',
    ],
    'organization_code' => [
        'empty' => 'Kod organisasi tidak boleh kosong',
    ],
    'knowledge_code' => [
        'empty' => 'Kod pengetahuan tidak boleh kosong',
    ],
    'flow_code' => [
        'empty' => 'Kod aliran tidak boleh kosong',
    ],
    'flow_entity' => [
        'empty' => 'Entiti aliran tidak boleh kosong',
    ],
    'name' => [
        'empty' => 'Nama tidak boleh kosong',
    ],
    'branches' => [
        'empty' => 'Cabang tidak boleh kosong',
    ],
    'conversation_id' => [
        'empty' => 'ID perbualan tidak boleh kosong',
    ],
    'creator' => [
        'empty' => 'Pengendali tidak boleh kosong',
    ],
    'model' => [
        'empty' => 'Model tidak boleh kosong',
        'not_found' => '[:model_name] Model tidak dijumpai',
        'disabled' => 'Model [:model_name] dimatikan',
        'not_support_embedding' => '[:model_name] tidak menyokong pembenaman',
        'error_config_missing' => 'Item konfigurasi :name hilang. Sila periksa tetapan atau hubungi pentadbir.',
        'embedding_failed' => '[:model_name] pembenaman gagal, mesej ralat: [:error_message], sila periksa konfigurasi pembenaman',
        'vector_size_not_match' => '[:model_name] saiz vektor tidak sepadan, saiz yang dijangka: [:expected_size], saiz sebenar: [:actual_size], sila periksa saiz vektor',
    ],
    'knowledge_base' => [
        're_vectorized_not_support' => 'Tidak menyokong pembenaman semula',
    ],
    'max_record' => [
        'positive_integer' => 'Bilangan rekod maksimum mesti integer positif antara :min dan :max',
    ],
    'nodes' => [
        'empty' => 'Tiada nod',
    ],
    'node_id' => [
        'empty' => 'ID nod tidak boleh kosong',
    ],
    'node_type' => [
        'empty' => 'Jenis nod tidak boleh kosong',
        'unsupported' => 'Jenis nod tidak disokong',
    ],
    'tool_set' => [
        'not_edit_default_tool_set' => 'Tidak boleh mengedit set alat lalai',
    ],
    'node' => [
        'empty' => 'Nod tidak boleh kosong',
        'execute_num_limit' => 'Bilangan pelaksanaan nod [:name] melebihi had maksimum',
        'duplication_node_id' => 'ID Nod[:node_id] berulang',
        'single_debug_not_support' => 'Penyahpepijatan titik tunggal tidak disokong',
        'cache_key' => [
            'empty' => 'Kunci cache tidak boleh kosong',
            'string_only' => 'Kunci cache mesti rentetan',
        ],
        'cache_value' => [
            'empty' => 'Nilai cache tidak boleh kosong',
            'string_only' => 'Nilai cache mesti rentetan',
        ],
        'cache_ttl' => [
            'empty' => 'Masa cache tidak boleh kosong',
            'int_only' => 'Masa cache mesti integer positif',
        ],
        'code' => [
            'empty' => 'Kod tidak boleh kosong',
            'empty_language' => 'Bahasa kod tidak boleh kosong',
            'unsupported_code_language' => '[:language] Bahasa kod tidak disokong',
            'execute_failed' => 'Pelaksanaan kod gagal | :error',
            'execution_error' => 'Ralat pelaksanaan kod: :error',
        ],
        'http' => [
            'api_request_fail' => 'Permintaan API gagal | :error',
            'output_error' => 'Ralat output API | :error',
        ],
        'intent' => [
            'empty' => 'Niat tidak boleh kosong',
            'title_empty' => 'Tajuk tidak boleh kosong',
            'desc_empty' => 'Penerangan tidak boleh kosong',
        ],
        'knowledge_fragment_store' => [
            'knowledge_code_empty' => 'Kod pengetahuan tidak boleh kosong',
            'content_empty' => 'Serpihan teks tidak boleh kosong',
        ],
        'knowledge_similarity' => [
            'knowledge_codes_empty' => 'Kod pengetahuan tidak boleh kosong',
            'query_empty' => 'Kandungan carian tidak boleh kosong',
            'limit_valid' => 'Kuantiti mesti integer positif antara :min dan :max',
            'score_valid' => 'Skor mesti nombor titik terapung antara 0 dan 1',
        ],
        'llm' => [
            'tools_execute_failed' => 'Pelaksanaan alat gagal | :error',
        ],
        'loop' => [
            'relation_id_empty' => 'ID badan gelung berkaitan tidak boleh kosong',
            'origin_flow_not_found' => '[:label] Aliran tidak dijumpai',
            'count_format_error' => 'Kiraan gelung mesti integer positif',
            'array_format_error' => 'Tatasusunan gelung mesti tatasusunan',
            'max_loop_count_format_error' => 'Kiraan jelajah maksimum mesti integer positif antara :min dan :max',
            'loop_flow_execute_failed' => 'Pelaksanaan badan gelung gagal :error',
        ],
        'start' => [
            'only_one' => 'Hanya boleh ada satu nod mula',
            'must_exist' => 'Nod mula mesti wujud',
            'unsupported_trigger_type' => '[:trigger_type] Jenis pencetus tidak disokong',
            'unsupported_unit' => '[:unit] Unit masa tidak disokong',
            'content_empty' => 'Mesej tidak boleh kosong',
            'unsupported_routine_type' => 'Jenis rutin tidak disokong',
            'input_key_conflict' => 'Nama medan [:key] bercanggah dengan medan terpelihara sistem, sila gunakan nama lain',
            'json_schema_validation_failed' => 'Ralat format JSON Schema: :error',
        ],
        'sub' => [
            'flow_not_found' => 'SubFlow [:flow_code] tidak dijumpai',
            'start_node_not_found' => 'Nod mula SubFlow [:flow_code] tidak dijumpai',
            'end_node_not_found' => 'Nod akhir SubFlow [:flow_code] tidak dijumpai',
            'execute_failed' => 'Pelaksanaan SubFlow [:flow_name] gagal :error',
            'flow_id_empty' => 'ID SubFlow tidak boleh kosong',
        ],
        'tool' => [
            'tool_id_empty' => 'ID alat tidak boleh kosong',
            'flow_not_found' => 'Alat [:flow_code] tidak dijumpai',
            'start_node_not_found' => 'Nod mula alat [:flow_code] tidak dijumpai',
            'end_node_not_found' => 'Nod akhir alat [:flow_code] tidak dijumpai',
            'execute_failed' => 'Pelaksanaan alat [:flow_name] gagal :error',
            'name' => [
                'invalid_format' => 'Nama alat hanya boleh mengandungi huruf, nombor, dan garis bawah',
            ],
        ],
        'end' => [
            'must_exist' => 'Nod akhir mesti wujud',
        ],
        'text_embedding' => [
            'text_empty' => 'Teks tidak boleh kosong',
        ],
        'text_splitter' => [
            'text_empty' => 'Teks tidak boleh kosong',
        ],
        'variable' => [
            'name_empty' => 'Nama pembolehubah tidak boleh kosong',
            'name_invalid' => 'Nama pembolehubah hanya boleh mengandungi huruf, nombor, dan garis bawah, dan tidak boleh bermula dengan nombor',
            'value_empty' => 'Nilai pembolehubah tidak boleh kosong',
            'value_format_error' => 'Ralat format nilai pembolehubah',
            'variable_not_exist' => 'Pembolehubah [:var_name] tidak wujud',
            'variable_not_array' => 'Pembolehubah [:var_name] bukan tatasusunan',
            'element_list_empty' => 'Senarai elemen tidak boleh kosong',
        ],
        'message' => [
            'type_error' => 'Ralat jenis mesej',
            'unsupported_message_type' => 'Jenis mesej tidak disokong',
            'content_error' => 'Ralat kandungan mesej',
        ],
        'knowledge_fragment_remove' => [
            'metadata_business_id_empty' => 'Metadata atau ID perniagaan tidak boleh kosong',
        ],
    ],
    'executor' => [
        'unsupported_node_type' => '[:node_type] Jenis nod tidak disokong',
        'has_circular_dependencies' => '[:label] Pergantungan kitaran wujud',
        'unsupported_trigger_type' => 'Jenis pencetus tidak disokong',
        'unsupported_flow_type' => 'Jenis aliran tidak disokong',
        'node_execute_count_reached' => 'Bilangan pelaksanaan nod global maksimum (:max_count) tercapai',
    ],
    'component' => [
        'format_error' => '[:label] Ralat format',
    ],
    'fields' => [
        'flow_name' => 'Nama Aliran',
        'flow_type' => 'Jenis Aliran',
        'organization_code' => 'Kod Organisasi',
        'creator' => 'Pencipta',
        'creator_uid' => 'UID Pencipta',
        'tool_name' => 'Nama Alat',
        'tool_description' => 'Penerangan Alat',
        'nodes' => 'Senarai Nod',
        'node' => 'Nod',
        'api_key' => 'Kunci API',
        'api_key_name' => 'Nama Kunci API',
        'test_case_name' => 'Nama Kes Ujian',
        'flow_code' => 'Kod Aliran',
        'created_at' => 'Masa Dibuat',
        'case_config' => 'Konfigurasi Ujian',
        'nickname' => 'Nama Samaran',
        'chat_time' => 'Masa Bual',
        'message_type' => 'Jenis Mesej',
        'content' => 'Kandungan',
        'open_time' => 'Masa Buka',
        'trigger_type' => 'Jenis Pencetus',
        'message_id' => 'ID Mesej',
        'type' => 'Jenis',
        'analysis_result' => 'Hasil Analisis',
        'model_name' => 'Nama Model',
        'implementation' => 'Pelaksanaan',
        'vector_size' => 'Saiz Vektor',
        'conversation_id' => 'ID Perbualan',
        'modifier' => 'Pengubah',
    ],
];
