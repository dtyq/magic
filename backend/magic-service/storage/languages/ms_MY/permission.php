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
        'safe_sub_admin' => 'Sub pentadbir',
        'ai_model' => 'Model besar',
        'ai_image' => 'Lukisan pintar',
        'ai_ability' => 'Pengurusan keupayaan',
        'ai_mode' => 'Mod',
        'console' => 'Konsol',
        'api' => 'Antara muka',
        'api_assistant' => 'Pembantu antara muka',
        'platform' => 'Pengurusan platform',
        'platform_ai' => 'Pengurusan AI',
        'platform_setting' => 'Tetapan sistem',
        'platform_setting_maintenance' => 'Pengurusan penyelenggaraan',
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
    ],
];
