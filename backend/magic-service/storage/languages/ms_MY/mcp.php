<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fields' => [
        'code' => 'Kod',
        'name' => 'Nama',
        'description' => 'Penerangan',
        'status' => 'Status',
        'external_sse_url' => 'URL Perkhidmatan MCP',
        'url' => 'URL',
        'command' => 'Arahan',
        'arguments' => 'Argumen',
        'headers' => 'Pengepala',
        'env' => 'Pembolehubah Persekitaran',
        'oauth2_config' => 'Konfigurasi OAuth2',
        'client_id' => 'ID Klien',
        'client_secret' => 'Rahsia Klien',
        'client_url' => 'URL Klien',
        'scope' => 'Skop',
        'authorization_url' => 'URL Kebenaran',
        'authorization_content_type' => 'Jenis Kandungan Kebenaran',
        'issuer_url' => 'URL Pengeluar',
        'redirect_uri' => 'URI Ubah Hala',
        'use_pkce' => 'Gunakan PKCE',
        'response_type' => 'Jenis Respons',
        'grant_type' => 'Jenis Geran',
        'additional_params' => 'Parameter Tambahan',
        'created_at' => 'Dicipta Pada',
        'updated_at' => 'Dikemas kini Pada',
    ],
    'auth_type' => [
        'none' => 'Tiada Pengesahan',
        'oauth2' => 'Pengesahan OAuth2',
    ],

    // Mesej ralat
    'validate_failed' => 'Pengesahan gagal',
    'not_found' => 'Data tidak dijumpai',

    // Ralat berkaitan perkhidmatan
    'service' => [
        'already_exists' => 'Perkhidmatan MCP sudah wujud',
        'not_enabled' => 'Perkhidmatan MCP tidak diaktifkan',
    ],

    // Ralat berkaitan pelayan
    'server' => [
        'not_support_check_status' => 'Jenis pemeriksaan status pelayan ini tidak disokong',
    ],

    // Ralat hubungan sumber
    'rel' => [
        'not_found' => 'Sumber berkaitan tidak dijumpai',
        'not_enabled' => 'Sumber berkaitan tidak diaktifkan',
    ],
    'rel_version' => [
        'not_found' => 'Versi sumber berkaitan tidak dijumpai',
    ],

    // Ralat alat
    'tool' => [
        'execute_failed' => 'Pelaksanaan alat gagal',
    ],

    // Ralat pengesahan OAuth2
    'oauth2' => [
        'authorization_url_generation_failed' => 'Gagal menjana URL kebenaran OAuth2',
        'callback_handling_failed' => 'Gagal mengendalikan panggilan balik OAuth2',
        'token_refresh_failed' => 'Gagal menyegarkan token OAuth2',
        'invalid_response' => 'Respons tidak sah dari penyedia OAuth2',
        'provider_error' => 'Penyedia OAuth2 mengembalikan ralat',
        'missing_access_token' => 'Tiada token akses diterima dari penyedia OAuth2',
        'invalid_service_configuration' => 'Konfigurasi perkhidmatan OAuth2 tidak sah',
        'missing_configuration' => 'Konfigurasi OAuth2 hilang',
        'not_authenticated' => 'Pengesahan OAuth2 tidak ditemui untuk perkhidmatan ini',
        'no_refresh_token' => 'Tiada token penyegaran tersedia untuk penyegaran token',
        'binding' => [
            'code_empty' => 'Kod kebenaran tidak boleh kosong',
            'state_empty' => 'Parameter keadaan tidak boleh kosong',
            'mcp_server_code_empty' => 'Kod pelayan MCP tidak boleh kosong',
        ],
    ],

    // Ralat pengesahan arahan
    'command' => [
        'not_allowed' => 'Arahan tidak disokong ":command", pada masa ini hanya menyokong: :allowed_commands',
    ],

    // Ralat pengesahan medan yang diperlukan
    'required_fields' => [
        'missing' => 'Medan yang diperlukan tiada: :fields',
        'empty' => 'Medan yang diperlukan tidak boleh kosong: :fields',
    ],

    // Ralat berkaitan pelaksana STDIO
    'executor' => [
        'stdio' => [
            'connection_failed' => 'Sambungan pelaksana STDIO gagal',
            'access_denied' => 'Fungsi pelaksana STDIO tidak disokong buat masa ini',
        ],
        'http' => [
            'connection_failed' => 'Sambungan pelaksana HTTP gagal',
        ],
    ],
];
