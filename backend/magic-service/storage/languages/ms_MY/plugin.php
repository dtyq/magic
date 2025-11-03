<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'param_error' => 'Ralat parameter',
    'not_found' => 'Plugin tidak dijumpai',
    'name' => [
        'required' => 'Nama plugin adalah wajib',
    ],
    'description' => [
        'required' => 'Penerangan plugin adalah wajib',
    ],
    'type' => [
        'required' => 'Jenis plugin adalah wajib',
        'modification_not_allowed' => 'Jenis plugin tidak dibenarkan diubah',
    ],
    'creator' => [
        'required' => 'Pencipta adalah wajib',
    ],
    'api_config' => [
        'required' => 'Konfigurasi antara muka adalah wajib',
        'api_url' => [
            'required' => 'Alamat API adalah wajib',
            'invalid' => 'Alamat API tidak sah',
        ],
        'auth_type' => [
            'required' => 'Jenis pengesahan adalah wajib',
        ],
        'auth_config' => [
            'invalid' => 'Konfigurasi pengesahan tidak sah',
        ],
    ],
];
