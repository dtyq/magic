<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'file_not_found' => '文件未找到',
    'file_exist' => '文件已存在',
    'illegal_file_key' => '非法的文件键',
    'target_parent_not_directory' => '目标父级不是目录',
    'cannot_move_to_subdirectory' => '不能将目录移动到其子目录',
    'file_move_failed' => '移动文件失败',
    'file_save_failed' => '保存文件失败',
    'file_create_failed' => '创建文件失败',
    'file_delete_failed' => '删除文件失败',
    'file_rename_failed' => '重命名文件失败',
    'directory_delete_failed' => '删除目录失败',
    'batch_delete_failed' => '批量删除文件失败',
    'batch_move_failed' => '批量移动文件失败',
    'permission_denied' => '文件权限被拒绝',
    'files_not_found_or_no_permission' => '文件未找到或无访问权限',
    'content_too_large' => '文件内容过大',
    'concurrent_modification' => '文件并发修改冲突',
    'save_rate_limit' => '文件保存频率限制',
    'upload_failed' => '文件上传失败',

    // Batch download related
    'batch_file_ids_required' => '文件ID列表不能为空',
    'batch_file_ids_invalid' => '文件ID格式无效',
    'batch_too_many_files' => '批量下载文件数量不能超过1000个',
    'batch_no_valid_files' => '没有可访问的有效文件',
    'batch_access_denied' => '批量下载任务访问被拒绝',
    'batch_publish_failed' => '批量下载任务发布失败',

    // File conversion related
    'convert_file_ids_required' => '文件ID列表不能为空',
    'convert_too_many_files' => '文件转换数量不能超过50个',
    'convert_no_valid_files' => '没有可转换的有效文件',
    'convert_access_denied' => '文件转换任务访问被拒绝',
    'convert_same_sandbox_required' => '文件必须在同一个沙箱中',
    'convert_create_zip_failed' => '创建ZIP文件失败',
    'convert_no_converted_files' => '没有有效的转换文件用于创建ZIP',
    'convert_failed' => '文件转换失败，请重试',
];
