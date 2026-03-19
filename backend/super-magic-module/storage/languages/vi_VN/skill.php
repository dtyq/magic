<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'import_concurrent_error' => 'Lỗi đồng thời khi nhập Skill, vui lòng thử lại sau',
    'invalid_file_format' => 'Định dạng tệp không hợp lệ, chỉ hỗ trợ định dạng .skill hoặc .zip',
    'file_too_large' => 'Tệp quá lớn, kích thước tệp không được vượt quá :max_size byte',
    'extracted_file_too_large' => 'Tổng kích thước tệp đã giải nén quá lớn',
    'skill_json_not_supported' => 'Định dạng skill.json không được hỗ trợ, vui lòng sử dụng định dạng SKILL.md',
    'skill_md_not_found' => 'Không tìm thấy tệp SKILL.md',
    'skill_md_read_failed' => 'Đọc tệp SKILL.md thất bại',
    'package_name_required' => 'package_name là bắt buộc',
    'invalid_package_name_format' => 'Định dạng package_name không hợp lệ, chỉ cho phép chữ thường, số, dấu gạch ngang và gạch dưới, độ dài không được vượt quá 128 ký tự',
    'invalid_import_token' => 'Token nhập không hợp lệ',
    'import_token_expired' => 'Token nhập đã hết hạn',
    'skill_version_not_found' => 'Không tìm thấy phiên bản Skill',
    'file_upload_failed' => 'Tải lên tệp thất bại',
    'code' => 'Lỗi mã Skill',
    'extracted_directory_not_found' => 'Thư mục giải nén không tồn tại',
    'extracted_directory_name_mismatch' => 'Tên tệp nén không khớp với tên thư mục giải nén',
    'file_download_failed' => 'Tải xuống tệp thất bại',
    'file_not_found' => 'Không tìm thấy tệp',
    'file_key_required' => 'Khóa tệp là bắt buộc',
    'file_key_must_be_string' => 'Khóa tệp phải là chuỗi',
    'page_must_be_integer' => 'Số trang phải là số nguyên',
    'page_must_be_greater_than_zero' => 'Số trang phải lớn hơn không',
    'page_size_must_be_integer' => 'Kích thước trang phải là số nguyên',
    'page_size_must_be_greater_than_zero' => 'Kích thước trang phải lớn hơn không',
    'page_size_must_not_exceed_100' => 'Kích thước trang không được vượt quá 100',
    'keyword_must_be_string' => 'Từ khóa phải là chuỗi',
    'keyword_too_long' => 'Từ khóa quá dài',
    'invalid_source_type' => 'Loại nguồn không hợp lệ',
    'version_already_exists' => 'Version already exists',
    'publish_target_type_invalid' => 'Invalid publish target type',
    'publish_target_value_should_be_empty' => 'Publish target value must be empty',
    'non_official_organization_cannot_publish_to_market' => 'Only the official organization can publish skills to the market',
    'skill_creator_cannot_add_from_market' => 'The skill creator cannot add their own market skill',
];
