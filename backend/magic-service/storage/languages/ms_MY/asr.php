<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'success' => [
        'success' => 'Berjaya',
    ],
    'driver_error' => [
        'driver_not_found' => 'Pemandu ASR tidak ditemui untuk konfigurasi: :config',
    ],
    'request_error' => [
        'invalid_params' => 'Parameter permintaan tidak sah',
        'no_permission' => 'Tiada kebenaran akses',
        'freq_limit' => 'Frekuensi akses terlebih',
        'quota_limit' => 'Kuota akses terlebih',
    ],
    'server_error' => [
        'server_busy' => 'Pelayan sibuk',
        'unknown_error' => 'Ralat tidak dikenali',
    ],
    'audio_error' => [
        'audio_too_long' => 'Audio terlalu panjang',
        'audio_too_large' => 'Audio terlalu besar',
        'invalid_audio' => 'Format audio tidak sah',
        'audio_silent' => 'Audio senyap',
        'analysis_failed' => 'Analisis fail audio gagal',
        'invalid_parameters' => 'Parameter audio tidak sah',
    ],
    'recognition_error' => [
        'wait_timeout' => 'Timeout menunggu pengecaman',
        'process_timeout' => 'Timeout pemprosesan pengecaman',
        'recognize_error' => 'Ralat pengecaman',
    ],
    'connection_error' => [
        'websocket_connection_failed' => 'Sambungan WebSocket gagal',
    ],
    'file_error' => [
        'file_not_found' => 'Fail audio tidak ditemui',
        'file_open_failed' => 'Gagal membuka fail audio',
        'file_read_failed' => 'Gagal membaca fail audio',
    ],
    'invalid_audio_url' => 'Format URL audio tidak sah',
    'audio_url_required' => 'URL audio diperlukan',
    'processing_error' => [
        'decompression_failed' => 'Gagal menyahmampat payload',
        'json_decode_failed' => 'Gagal menyahkod JSON',
    ],
    'config_error' => [
        'invalid_config' => 'Konfigurasi tidak sah',
        'invalid_language' => 'Bahasa tidak disokong',
        'unsupported_platform' => 'Platform ASR tidak disokong : :platform',
    ],
    'uri_error' => [
        'uri_open_failed' => 'Gagal membuka URI audio',
        'uri_read_failed' => 'Gagal membaca URI audio',
    ],
    'download' => [
        'success' => 'Berjaya mendapat pautan muat turun',
        'file_not_exist' => 'Fail audio gabungan tidak wujud, sila proses ringkasan suara terlebih dahulu',
        'get_link_failed' => 'Tidak dapat mendapat pautan akses fail audio gabungan',
        'get_link_error' => 'Gagal mendapat pautan muat turun: :error',
    ],
    'api' => [
        'validation' => [
            'task_key_required' => 'Parameter kunci tugas diperlukan',
            'project_id_required' => 'Parameter ID projek diperlukan',
            'chat_topic_id_required' => 'Parameter ID topik sembang diperlukan',
            'model_id_required' => 'Parameter ID model diperlukan',
            'file_required' => 'Parameter fail diperlukan',
            'task_not_found' => 'Tugas tidak dijumpai atau telah tamat tempoh',
            'task_not_exist' => 'Tugas tidak wujud atau telah tamat tempoh',
            'upload_audio_first' => 'Sila muat naik fail audio terlebih dahulu',
            'note_content_too_long' => 'Kandungan nota terlalu panjang, maksimum 10000 aksara disokong, semasa :length aksara',
        ],
        'upload' => [
            'start_log' => 'Mula muat naik fail ASR',
            'success_log' => 'Muat naik fail ASR berjaya',
            'success_message' => 'Muat naik fail berjaya',
            'failed_log' => 'Muat naik fail ASR gagal',
            'failed_exception' => 'Muat naik fail gagal: :error',
        ],
        'token' => [
            'cache_cleared' => 'Cache ASR Token telah dibersihkan dengan jayanya',
            'cache_not_exist' => 'Cache ASR Token tidak wujud',
            'access_token_not_configured' => 'Token akses ASR tidak dikonfigurasi',
            'sts_get_failed' => 'Perolehan STS Token gagal: temporary_credential.dir kosong, sila semak konfigurasi perkhidmatan storan',
            'usage_note' => 'Token ini khusus untuk muat naik fail rakaman ASR secara berkeping, sila muat naik fail rakaman ke direktori yang dinyatakan',
            'reuse_task_log' => 'Menggunakan semula kunci tugas, menyegarkan STS Token',
        ],
        'speech_recognition' => [
            'task_id_missing' => 'ID tugas pengecaman pertuturan tidak wujud',
            'request_id_missing' => 'Perkhidmatan pengecaman pertuturan tidak mengembalikan ID permintaan',
            'submit_failed' => 'Penyerahan tugas penukaran audio gagal: :error',
            'silent_audio_error' => 'Audio senyap, sila semak jika fail audio mengandungi kandungan pertuturan yang sah',
            'internal_server_error' => 'Ralat pemprosesan dalaman pelayan, kod status: :code',
            'unknown_status_error' => 'Pengecaman pertuturan gagal, kod status tidak diketahui: :code',
        ],
        'directory' => [
            'invalid_asr_path' => 'Direktori mesti mengandungi laluan "/asr/recordings"',
            'security_path_error' => 'Laluan direktori tidak boleh mengandungi ".." atas sebab keselamatan',
            'ownership_error' => 'Direktori bukan kepunyaan pengguna semasa',
            'invalid_structure' => 'Struktur direktori ASR tidak sah',
            'invalid_structure_after_recordings' => 'Struktur direktori tidak sah selepas "/asr/recordings"',
            'user_id_not_found' => 'ID pengguna tidak ditemui dalam laluan direktori',
        ],
        'status' => [
            'get_file_list_failed' => 'Pertanyaan status ASR: Gagal mendapat senarai fail',
        ],
        'redis' => [
            'save_task_status_failed' => 'Simpan status tugas Redis gagal',
        ],
    ],

    // Direktori berkaitan
    'directory' => [
        'recordings_summary_folder' => 'Ringkasan Rakaman',
    ],

    // Nama fail berkaitan
    'file_names' => [
        'recording_prefix' => 'Rakaman',
        'merged_audio_prefix' => 'Fail Rakaman',
        'original_recording' => 'Fail Rakaman Asal',
        'transcription_prefix' => 'Hasil Transkripsi',
        'summary_prefix' => 'Ringkasan Rakaman',
        'note_prefix' => 'Nota Rakaman',
        'note_suffix' => 'Nota', // Untuk menjana nama fail nota dengan tajuk: {title}-Nota.{ext}
    ],

    // Kandungan Markdown berkaitan
    'markdown' => [
        'transcription_title' => 'Hasil Tukar Pertuturan ke Teks',
        'transcription_content_title' => 'Kandungan Transkripsi',
        'summary_title' => 'Ringkasan Rakaman AI',
        'summary_content_title' => 'Kandungan Ringkasan AI',
        'task_id_label' => 'ID Tugas',
        'generate_time_label' => 'Masa Dijana',
    ],

    // Berkaitan dengan mesej sembang
    'messages' => [
        'summary_content' => ' Ringkaskan kandungan',
        'summary_content_with_note' => 'Semasa merumuskan rakaman, sila rujuk fail nota rakaman dalam direktori yang sama dan dasarkan ringkasan pada kedua-dua nota dan rakaman.',
        // Awalan/akhiran i18n baru (tanpa nota)
        'summary_prefix' => 'Sila bantu saya meringkaskan kandungan rakaman dalam ',
        'summary_suffix' => ' ke dalam dokumen minit, dan cipta laporan analisis HTML yang terperinci.',
        // Awalan/akhiran i18n baru (dengan nota)
        'summary_prefix_with_note' => 'Sila bantu saya menyusun kandungan rakaman dalam ',
        'summary_middle_with_note' => ' dan kandungan nota saya dalam ',
        'summary_suffix_with_note' => ' ke dalam dokumen minit, dan gabungkan kandungan nota untuk mencipta laporan analisis HTML yang terperinci.',
    ],
];
