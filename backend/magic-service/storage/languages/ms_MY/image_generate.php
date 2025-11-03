<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => 'Perkhidmatan penjanaan imej mengalami pengecualian',
    'response_format_error' => 'Format respons penjanaan imej ralat',
    'missing_image_data' => 'Data imej yang dijana mengalami pengecualian',
    'no_valid_image_generated' => 'Tiada imej sah dijana',
    'input_image_audit_failed' => 'Imej yang anda hantar tidak mematuhi peraturan dan keperluan berkaitan, tidak dapat menjana imej yang sepadan untuk anda',
    'output_image_audit_failed' => 'Audit imej keluaran tidak lulus',
    'input_text_audit_failed' => 'Teks yang anda hantar tidak mematuhi peraturan dan keperluan berkaitan, tidak dapat menjana imej yang sepadan untuk anda',
    'output_text_audit_failed' => 'Audit teks keluaran tidak lulus',
    'text_blocked' => 'Teks input mengandungi kandungan sensitif, telah disekat',
    'invalid_prompt' => 'Kandungan prompt tidak sah',
    'prompt_check_failed' => 'Pengesahan prompt gagal',
    'polling_failed' => 'Polling hasil tugas gagal',
    'task_timeout' => 'Pelaksanaan tugas tamat masa',
    'invalid_request_type' => 'Jenis permintaan tidak sah',
    'missing_job_id' => 'ID tugas tidak dijumpai',
    'task_failed' => 'Pelaksanaan tugas gagal',
    'polling_response_format_error' => 'Format respons polling ralat',
    'missing_image_url' => 'Tidak mendapat URL imej',
    'prompt_check_response_error' => 'Format respons pengesahan prompt ralat',
    'api_request_failed' => 'Panggilan antara muka penjanaan imej gagal',
    'image_to_image_missing_source' => 'Imej ke imej kekurangan sumber: imej atau base64',
    'output_image_audit_failed_with_reason' => 'Tidak dapat menjana imej, sila cuba tukar kata prompt',
    'task_timeout_with_reason' => 'Tugas penjanaan imej tidak dijumpai atau telah tamat tempoh',
    'not_found_error_code' => 'Kod ralat tidak diketahui',
    'unsupported_image_format' => 'Hanya menyokong format imej JPG, JPEG, BMP, PNG',
    'invalid_aspect_ratio' => 'Perbezaan nisbah dimensi imej ke imej terlalu besar, hanya boleh berbeza 3 kali ganda',
    'image_url_is_empty' => 'Imej kosong',
    'unsupported_image_size' => 'Saiz imej :size tidak disokong, saiz yang disokong ialah: :supported_sizes',
    'unsupported_image_size_range' => 'Saiz imej :size melebihi julat sokongan, lebar dan tinggi mesti antara :min_size-:max_size piksel',

    // Azure OpenAI 相关错误消息
    'api_key_update_failed' => 'Kemaskini kunci API gagal',
    'prompt_required' => 'Kata prompt penjanaan imej tidak boleh kosong',
    'reference_images_required' => 'Penyuntingan imej memerlukan imej rujukan',
    'invalid_image_count' => 'Bilangan penjanaan imej mesti antara 1-10',
    'invalid_image_url' => 'Format URL imej rujukan tidak sah',
    'invalid_mask_url' => 'Format URL imej topeng tidak sah',
    'no_image_generated' => 'Tiada imej dijana',
    'invalid_image_data' => 'Semua data imej tidak sah',
    'no_valid_image_data' => 'Tiada data imej sah',
    'response_build_failed' => 'Pembinaan respons gagal',
    'api_call_failed' => 'Panggilan API gagal',
    'request_conversion_failed' => 'Penukaran format permintaan gagal',
    'invalid_size_format' => 'Format saiz tidak sah, sepatutnya format LEBARxTINGGI',
    'invalid_quality_parameter' => 'Parameter kualiti tidak sah, pilihan yang sah ialah: standard, hd',

    'model_not_support_edit' => 'Model tidak menyokong penyuntingan imej',
    # 水印相关
    'image_watermark' => 'Dijana oleh Maiji AI',
];
