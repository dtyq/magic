<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'resource' => [
        'admin' => 'Backend pentadbiran',
        'admin_ai' => 'Pengurusan AI',
        'admin_safe' => 'Keselamatan & Kebenaran',
        'safe_function_permission' => 'Kebenaran Fungsi',
        'safe_admin' => 'Pentadbir organisasi',
        'safe_sub_admin' => 'Sub pentadbir',
        'safe_operation_log' => 'Log pentadbir',
        'ai_model' => 'Model besar',
        'ai_image' => 'Lukisan pintar',
        'admin_ai_model' => 'Model besar',
        'admin_ai_image' => 'Lukisan pintar',
        'ai_ability' => 'Pengurusan keupayaan',
        'ai_mode' => 'Mod',
        'ai_agent' => 'Pengurusan ejen',
        'ai_skill' => 'Pengurusan kemahiran',
        'console' => 'Konsol',
        'api' => 'Antara muka',
        'api_assistant' => 'Pembantu antara muka',
        'platform' => 'Pengurusan platform',
        'platform_ai' => 'Pengurusan AI',
        'workspace' => 'Pengurusan ruang kerja',
        'workspace_ai' => 'Pengurusan AI',
        'workspace_ai_model' => 'Model besar',
        'workspace_ai_image' => 'Lukisan pintar',
        'workspace_ai_model_audit_log' => 'Log audit model',
        'platform_ai_model_audit_log' => 'Log audit model',
        'platform_setting' => 'Tetapan sistem',
        'platform_setting_maintenance' => 'Pengurusan penyelenggaraan',
        'platform_organization' => 'Pengurusan organisasi',
        'platform_organization_list' => 'Senarai organisasi',
        'platform_user_list' => 'Senarai pengguna platform',
    ],
    // 顶层错误与校验
    'validate_failed' => 'Pengesahan gagal',
    'business_exception' => 'Pengecualian perniagaan',
    'access_denied' => 'Tiada kebenaran capaian',
    // 组织相关错误（PermissionErrorCode 42***）
    'organization_code_required' => 'Kod organisasi wajib diisi',
    'organization_name_required' => 'Nama organisasi wajib diisi',
    'organization_industry_type_required' => 'Jenis industri organisasi wajib diisi',
    'organization_seats_invalid' => 'Bilangan kerusi organisasi tidak sah',
    'organization_code_exists' => 'Kod organisasi sudah wujud',
    'organization_name_exists' => 'Nama organisasi sudah wujud',
    'organization_not_exists' => 'Organisasi tidak wujud',
    'function_permission' => [
        'modules' => [
            'skill' => 'Kemahiran',
            'agent' => 'Ejen',
            'magic_claw' => 'Magic Claw',
        ],
        'functions' => [
            'skill_create' => [
                'name' => 'Cipta Kemahiran',
                'description' => 'Pintu masuk untuk mencipta kemahiran kosong.',
            ],
            'skill_publish' => [
                'name' => 'Terbitkan Kemahiran',
                'description' => 'Pintu masuk untuk menerbitkan versi kemahiran.',
            ],
            'agent_create' => [
                'name' => 'Cipta Ejen',
                'description' => 'Pintu masuk untuk mencipta pembantu atau ejen.',
            ],
            'agent_publish' => [
                'name' => 'Terbitkan Ejen',
                'description' => 'Pintu masuk untuk menerbitkan versi ejen.',
            ],
            'magic_claw_create' => [
                'name' => 'Cipta Magic Claw',
                'description' => 'Pintu masuk untuk mencipta Magic Claw.',
            ],
        ],
        'binding_scope_label' => [
            'all_users_available' => 'Tersedia untuk semua',
            'organization_all' => 'Seluruh organisasi',
            'specific_users_and_departments' => 'Pengguna dan jabatan tertentu',
            'specific_users' => 'Pengguna tertentu',
            'specific_departments' => 'Jabatan tertentu',
            'not_configured' => 'Belum dikonfigurasi',
        ],
    ],
    'operation' => [
        'query' => 'Pertanyaan',
        'edit' => 'Edit',
    ],
    'error' => [
        'role_name_exists' => 'Nama peranan :name sudah wujud',
        'role_not_found' => 'Peranan tidak wujud',
        'invalid_permission_key' => 'Kunci kebenaran :key tidak sah',
        'access_denied' => 'Tiada kebenaran capaian',
        'user_already_organization_admin' => 'Pengguna :userId sudah menjadi pentadbir organisasi',
        'organization_admin_not_found' => 'Pentadbir organisasi tidak wujud',
        'organization_creator_cannot_be_revoked' => 'Pencipta organisasi tidak boleh dibatalkan',
        'organization_creator_cannot_be_disabled' => 'Pencipta organisasi tidak boleh dilumpuhkan',
        'current_user_not_organization_creator' => 'Pengguna semasa bukan pencipta organisasi',
        'personal_organization_cannot_grant_admin' => 'Organisasi peribadi tidak boleh menetapkan pentadbir organisasi',
        'visibility_config_invalid' => 'Konfigurasi keterlihatan tidak sah',
        'only_organization_admin_can_configure_visibility' => 'Hanya pentadbir organisasi boleh mengkonfigurasi keterlihatan',
        'visibility_type_2_requires_users_or_departments' => 'Apabila jenis keterlihatan ialah 2 (keterlihatan separa), sekurang-kurangnya satu pengguna atau jabatan mesti ditentukan',
    ],
];
