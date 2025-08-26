<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => 'Operasi memori jangka panjang gagal',
    'prompt_file_not_found' => 'Fail prompt tidak dijumpai: :path',
    'not_found' => 'Memori tidak wujud',
    'creation_failed' => 'Penciptaan memori gagal',
    'update_failed' => 'Kemas kini memori gagal',
    'deletion_failed' => 'Penghapusan memori gagal',
    'evaluation' => [
        'llm_request_failed' => 'Permintaan penilaian memori gagal',
        'llm_response_parse_failed' => 'Penghuraian respons penilaian memori gagal',
        'score_parse_failed' => 'Penghuraian skor penilaian memori gagal',
    ],
    'entity' => [
        'content_too_long' => 'Panjang kandungan memori tidak boleh melebihi 65535 aksara',
        'pending_content_too_long' => 'Panjang kandungan memori tertunggak tidak boleh melebihi 65535 aksara',
        'enabled_status_restriction' => 'Hanya memori yang aktif boleh diaktifkan atau dimatikan',
        'user_memory_limit_exceeded' => 'Had memori pengguna telah dicapai (20 memori)',
    ],
    'api' => [
        'validation_failed' => 'Pengesahan parameter gagal: :errors',
        'memory_not_belong_to_user' => 'Memori tidak dijumpai atau tiada kebenaran akses',
        'partial_memory_not_belong_to_user' => 'Sebahagian memori tidak dijumpai atau tiada kebenaran akses',
        'accept_memories_failed' => 'Gagal menerima cadangan memori: :error',
        'memory_created_successfully' => 'Memori berjaya dicipta',
        'memory_updated_successfully' => 'Memori berjaya dikemas kini',
        'memory_deleted_successfully' => 'Memori berjaya dihapus',
        'memory_reinforced_successfully' => 'Memori berjaya diperkuat',
        'memories_batch_reinforced_successfully' => 'Memori berjaya diperkuat secara berkelompok',
        'memories_accepted_successfully' => 'Berjaya menerima :count cadangan memori',
        'memories_rejected_successfully' => 'Berjaya menolak dan menghapus :count cadangan memori',
        'batch_process_memories_failed' => 'Gagal memproses cadangan memori secara berkelompok',
        'batch_action_memories_failed' => 'Berkelompok :action cadangan memori gagal: :error',
        'user_manual_edit_explanation' => 'Pengguna mengubah suai kandungan memori secara manual',
        'content_auto_compressed_explanation' => 'Kandungan terlalu panjang, dimampatkan secara automatik',
        'parameter_validation_failed' => 'Pengesahan parameter gagal: :errors',
        'action_accept' => 'terima',
        'action_reject' => 'tolak',
    ],
];
