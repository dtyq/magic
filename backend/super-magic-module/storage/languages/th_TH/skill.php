<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'import_concurrent_error' => 'เกิดข้อผิดพลาดพร้อมกันในการนำเข้า Skill กรุณาลองใหม่อีกครั้ง',
    'invalid_file_format' => 'รูปแบบไฟล์ไม่ถูกต้อง รองรับเฉพาะรูปแบบ .skill หรือ .zip',
    'file_too_large' => 'ไฟล์ใหญ่เกินไป ขนาดไฟล์ต้องไม่เกิน :max_size ไบต์',
    'extracted_file_too_large' => 'ขนาดรวมของไฟล์ที่แตกออกมามากเกินไป',
    'skill_json_not_supported' => 'ไม่รองรับรูปแบบ skill.json กรุณาใช้รูปแบบ SKILL.md',
    'skill_md_not_found' => 'ไม่พบไฟล์ SKILL.md',
    'skill_md_read_failed' => 'อ่านไฟล์ SKILL.md ไม่สำเร็จ',
    'package_name_required' => 'ต้องระบุ package_name',
    'invalid_package_name_format' => 'รูปแบบ package_name ไม่ถูกต้อง อนุญาตเฉพาะตัวอักษรพิมพ์เล็ก ตัวเลข เครื่องหมายขีดและขีดล่าง ความยาวต้องไม่เกิน 128 ตัวอักษร',
    'invalid_import_token' => 'โทเค็นการนำเข้าไม่ถูกต้อง',
    'import_token_expired' => 'โทเค็นการนำเข้าหมดอายุแล้ว',
    'skill_version_not_found' => 'ไม่พบเวอร์ชัน Skill',
    'file_upload_failed' => 'อัปโหลดไฟล์ล้มเหลว',
    'code' => 'ข้อผิดพลาดรหัส Skill',
    'extracted_directory_not_found' => 'ไม่พบไดเรกทอรีที่แตกออกมา',
    'extracted_directory_name_mismatch' => 'ชื่อไฟล์บีบอัดไม่ตรงกับชื่อไดเรกทอรีที่แตกออกมา',
    'file_download_failed' => 'ดาวน์โหลดไฟล์ล้มเหลว',
    'file_not_found' => 'ไม่พบไฟล์',
    'file_key_required' => 'ต้องระบุคีย์ไฟล์',
    'file_key_must_be_string' => 'คีย์ไฟล์ต้องเป็นสตริง',
    'page_must_be_integer' => 'หมายเลขหน้าต้องเป็นจำนวนเต็ม',
    'page_must_be_greater_than_zero' => 'หมายเลขหน้าต้องมากกว่าศูนย์',
    'page_size_must_be_integer' => 'จำนวนรายการต่อหน้าต้องเป็นจำนวนเต็ม',
    'page_size_must_be_greater_than_zero' => 'จำนวนรายการต่อหน้าต้องมากกว่าศูนย์',
    'page_size_must_not_exceed_100' => 'จำนวนรายการต่อหน้าไม่เกิน 100',
    'keyword_must_be_string' => 'คำค้นหาต้องเป็นสตริง',
    'keyword_too_long' => 'คำค้นหายาวเกินไป',
    'invalid_source_type' => 'ประเภทแหล่งที่มาไม่ถูกต้อง',
];
