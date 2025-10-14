<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 模式相关错误信息
    'validate_failed' => 'Kegagalan pengesahan parameter',
    'mode_not_found' => 'Mod tidak dijumpai',
    'mode_identifier_already_exists' => 'Pengenal mod sudah wujud',
    'group_not_found' => 'Kumpulan tidak dijumpai',
    'group_name_already_exists' => 'Nama kumpulan sudah wujud',
    'invalid_distribution_type' => 'Kaedah agihan tidak sah',
    'follow_mode_not_found' => 'Mod yang diikuti tidak dijumpai',
    'cannot_follow_self' => 'Tidak boleh mengikuti diri sendiri',
    'mode_in_use_cannot_delete' => 'Mod sedang digunakan, tidak dapat dihapuskan',

    // 模式验证消息
    'name_required' => 'Nama mod diperlukan',
    'name_max' => 'Nama mod tidak boleh melebihi 100 aksara',
    'name_i18n_required' => 'Nama antarabangsa mod diperlukan',
    'name_i18n_array' => 'Nama antarabangsa mod mestilah array',
    'name_zh_cn_required' => 'Nama Cina mod diperlukan',
    'name_zh_cn_max' => 'Nama Cina mod tidak boleh melebihi 100 aksara',
    'name_en_us_required' => 'Nama Inggeris mod diperlukan',
    'name_en_us_max' => 'Nama Inggeris mod tidak boleh melebihi 100 aksara',
    'placeholder_i18n_array' => 'Pemegang tempat antarabangsa mestilah array',
    'placeholder_zh_cn_max' => 'Pemegang tempat Cina tidak boleh melebihi 500 aksara',
    'placeholder_en_us_max' => 'Pemegang tempat Inggeris tidak boleh melebihi 500 aksara',
    'identifier_required' => 'Pengenal mod diperlukan',
    'identifier_max' => 'Pengenal mod tidak boleh melebihi 50 aksara',
    'icon_max' => 'URL ikon tidak boleh melebihi 255 aksara',
    'color_max' => 'Nilai warna tidak boleh melebihi 10 aksara',
    'color_regex' => 'Nilai warna mestilah format kod warna heksadesimal yang sah',
    'description_max' => 'Penerangan tidak boleh melebihi 1000 aksara',
    'distribution_type_required' => 'Kaedah agihan diperlukan',
    'distribution_type_in' => 'Kaedah agihan mestilah 1 (konfigurasi bebas) atau 2 (konfigurasi warisan)',
    'follow_mode_id_integer' => 'ID mod ikutan mestilah integer',
    'follow_mode_id_min' => 'ID mod ikutan mestilah lebih besar daripada 0',
    'restricted_mode_identifiers_array' => 'Pengenal mod terhad mestilah array',

    // 分组验证消息
    'mode_id_required' => 'ID mod diperlukan',
    'mode_id_integer' => 'ID mod mestilah integer',
    'mode_id_min' => 'ID mod mestilah lebih besar daripada 0',
    'group_name_required' => 'Nama kumpulan diperlukan',
    'group_name_max' => 'Nama kumpulan tidak boleh melebihi 100 aksara',
    'group_name_zh_cn_required' => 'Nama Cina kumpulan diperlukan',
    'group_name_zh_cn_max' => 'Nama Cina kumpulan tidak boleh melebihi 100 aksara',
    'group_name_en_us_required' => 'Nama Inggeris kumpulan diperlukan',
    'group_name_en_us_max' => 'Nama Inggeris kumpulan tidak boleh melebihi 100 aksara',
    'sort_integer' => 'Berat susunan mestilah integer',
    'sort_min' => 'Berat susunan tidak boleh kurang daripada 0',
    'status_integer' => 'Status mestilah integer',
    'status_in' => 'Status mestilah 0 (lumpuh) atau 1 (aktif)',
    'status_boolean' => 'Status mestilah boolean',

    // 分组配置相关
    'groups_required' => 'Konfigurasi kumpulan diperlukan',
    'groups_array' => 'Konfigurasi kumpulan mestilah array',
    'groups_min' => 'Sekurang-kurangnya perlu mengkonfigurasi satu kumpulan',
    'model_ids_array' => 'Senarai ID model mestilah array',
    'model_id_integer' => 'ID model mestilah integer',
    'model_id_min' => 'ID model mestilah lebih besar daripada 0',
    'models_array' => 'Senarai model mestilah array',
    'model_id_required' => 'ID model diperlukan',
    'model_sort_integer' => 'Berat susunan model mestilah integer',
    'model_sort_min' => 'Berat susunan model tidak boleh kurang daripada 0',
];
