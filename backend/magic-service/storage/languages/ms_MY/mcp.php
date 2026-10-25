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
        'icon' => 'Ikon',
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
        'authorization_method' => 'Authorization Method',
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
    'field_too_long' => ':label tidak boleh melebihi :max aksara',

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

    // Pemeriksaan keupayaan MCP Authorization
    'authorization_capability' => [
        'unsupported' => 'Kebenaran standard MCP tidak dipilih untuk perkhidmatan ini',
        'not_configured' => 'Konfigurasi kebenaran standard MCP tiada',
        'resource_url_required' => 'MCP Resource mesti merupakan URL lengkap',
        'invalid_server_metadata' => 'Metadata pelayan kebenaran tidak sah',
        'missing_server_endpoints' => 'Metadata pelayan kebenaran tiada endpoint yang diperlukan',
        'probe_failed' => 'Pemeriksaan keupayaan MCP Authorization gagal',
        'registration' => [
            'pre_registered' => 'Pentadbir mesti mendaftarkan klien terlebih dahulu',
            'cimd_supported' => 'Pelayan kebenaran mengisytiharkan sokongan CIMD',
            'cimd_unsupported' => 'Pelayan kebenaran tidak mengisytiharkan sokongan CIMD',
            'dcr_found' => 'Endpoint pendaftaran klien dinamik ditemui',
            'dcr_missing' => 'Endpoint pendaftaran klien dinamik tidak ditemui',
        ],
        'warnings' => [
            'dcr_recommended' => 'Pendaftaran klien dinamik disyorkan; kebenaran pertama mungkin mencipta klien jauh.',
            'cimd_not_advertised' => 'URL CIMD dikonfigurasikan, tetapi pelayan kebenaran tidak mengiklankan sokongan CIMD secara jelas.',
            'token_auth_not_advertised' => 'Pelayan kebenaran tidak mengiklankan kaedah pengesahan token endpoint; none disyorkan.',
        ],
        'failure_reason' => [
            'remote_request' => 'Permintaan jauh gagal',
            'configuration_or_discovery' => 'Pengesahan konfigurasi atau penemuan kebenaran gagal',
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
