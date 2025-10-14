<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Token相关错误
    'token' => [
        'not_exist' => 'Token API tidak wujud',
        'expired' => 'Token API telah tamat tempoh',
        'model_not_support' => 'Token tidak menyokong model ini',
        'organization_not_support' => 'Token tidak menyokong organisasi ini',
        'ip_not_in_white_list' => 'Alamat IP tidak dalam senarai putih',
        'quota_not_enough' => 'Kuota token tidak mencukupi',
        'calculate_error' => 'Ralat pengiraan token',
        'create_error' => 'Gagal mencipta token',
    ],

    // 模型相关错误
    'model' => [
        'not_support' => 'Model tidak disokong',
        'response_fail' => 'Respons model gagal',
    ],

    // 组织相关错误
    'organization' => [
        'quota_not_enough' => 'Kuota organisasi tidak mencukupi',
    ],

    // 消息相关错误
    'message' => [
        'empty' => 'Mesej tidak boleh kosong',
    ],

    // 用户相关错误
    'user' => [
        'create_access_token_limit' => 'Bilangan token capaian yang dicipta pengguna melebihi had',
        'use_access_token_limit' => 'Bilangan token capaian yang digunakan pengguna melebihi had',
        'create_access_token_rate_limit' => 'Kekerapan cipta token capaian pengguna terhad',
    ],

    // 通用错误
    'rate_limit' => 'Kekerapan permintaan melebihi had',
    'msg_empty' => 'Mesej kosong',
    'user_id_not_exist' => 'ID pengguna tidak wujud',
    'validate_failed' => 'Pengesahan gagal',
];
