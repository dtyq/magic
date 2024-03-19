<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'fields' => [
            'code' => 'Kod',
            'codes' => 'Senarai Kod',
            'name' => 'Nama',
            'description' => 'Penerangan',
            'icon' => 'Ikon',
            'type' => 'Jenis',
            'enabled' => 'Status Diaktifkan',
            'prompt' => 'Prompt',
            'tools' => 'Konfigurasi Alat',
            'tool_code' => 'Kod Alat',
            'tool_name' => 'Nama Alat',
            'tool_type' => 'Jenis Alat',
            // Medan umum
            'page' => 'Halaman',
            'page_size' => 'Saiz Halaman',
            'creator_id' => 'ID Pencipta',
        ],
        'limit_exceeded' => 'Had ejen telah dicapai (:limit), tidak dapat mencipta lagi',
        'builtin_not_allowed' => 'Operasi ini tidak disokong untuk ejen terbina dalam',
        // Migrated from crew.php
        'validate_failed' => 'Pengesahan gagal',
        'not_found' => 'Crew tidak dijumpai',
        'save_failed' => 'Gagal menyimpan crew',
        'delete_failed' => 'Gagal memadam crew',
        'operation_failed' => 'Operasi gagal',
        'access_denied' => 'Akses ditolak untuk crew ini',
    ],
    'task' => [
        'prompt_length_exceeded' => 'Teks input terlalu panjang. Sila muat naik sebagai fail dan rujuk dalam dialog.',
    ],
];
