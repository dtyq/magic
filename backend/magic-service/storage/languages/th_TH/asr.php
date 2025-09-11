<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'success' => [
        'success' => 'สำเร็จ',
    ],
    'driver_error' => [
        'driver_not_found' => 'ไม่พบไดรเวอร์ ASR สำหรับการกำหนดค่า: :config',
    ],
    'request_error' => [
        'invalid_params' => 'พารามิเตอร์คำขอไม่ถูกต้อง',
        'no_permission' => 'ไม่มีสิทธิ์เข้าถึง',
        'freq_limit' => 'ความถี่ในการเข้าถึงเกินกำหนด',
        'quota_limit' => 'โควต้าการเข้าถึงเกินกำหนด',
    ],
    'server_error' => [
        'server_busy' => 'เซิร์ฟเวอร์ไม่ว่าง',
        'unknown_error' => 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    ],
    'audio_error' => [
        'audio_too_long' => 'เสียงยาวเกินไป',
        'audio_too_large' => 'ไฟล์เสียงใหญ่เกินไป',
        'invalid_audio' => 'รูปแบบเสียงไม่ถูกต้อง',
        'audio_silent' => 'เสียงเงียบ',
        'analysis_failed' => 'การวิเคราะห์ไฟล์เสียงล้มเหลว',
        'invalid_parameters' => 'พารามิเตอร์เสียงไม่ถูกต้อง',
    ],
    'recognition_error' => [
        'wait_timeout' => 'หมดเวลารอการรู้จำ',
        'process_timeout' => 'หมดเวลาประมวลผลการรู้จำ',
        'recognize_error' => 'ข้อผิดพลาดในการรู้จำ',
    ],
    'connection_error' => [
        'websocket_connection_failed' => 'การเชื่อมต่อ WebSocket ล้มเหลว',
    ],
    'file_error' => [
        'file_not_found' => 'ไม่พบไฟล์เสียง',
        'file_open_failed' => 'ไม่สามารถเปิดไฟล์เสียงได้',
        'file_read_failed' => 'ไม่สามารถอ่านไฟล์เสียงได้',
    ],
    'invalid_audio_url' => 'รูปแบบ URL เสียงไม่ถูกต้อง',
    'audio_url_required' => 'ต้องการ URL เสียง',
    'processing_error' => [
        'decompression_failed' => 'ไม่สามารถคลายการบีบอัด payload ได้',
        'json_decode_failed' => 'ไม่สามารถถอดรหัส JSON ได้',
    ],
    'config_error' => [
        'invalid_config' => 'การกำหนดค่าไม่ถูกต้อง',
        'invalid_language' => 'ภาษาที่ไม่รองรับ',
        'unsupported_platform' => 'แพลตฟอร์ม ASR ที่ไม่รองรับ : :platform',
    ],
    'uri_error' => [
        'uri_open_failed' => 'ไม่สามารถเปิด URI เสียงได้',
        'uri_read_failed' => 'ไม่สามารถอ่าน URI เสียงได้',
    ],
    'download' => [
        'success' => 'ได้รับลิงก์ดาวน์โหลดเรียบร้อยแล้ว',
        'file_not_exist' => 'ไฟล์เสียงที่รวมแล้วไม่มีอยู่ กรุณาประมวลผลสรุปเสียงก่อน',
        'get_link_failed' => 'ไม่สามารถรับลิงก์เข้าถึงไฟล์เสียงที่รวมแล้วได้',
        'get_link_error' => 'ไม่สามารถรับลิงก์ดาวน์โหลดได้: :error',
    ],
    'api' => [
        'validation' => [
            'task_key_required' => 'ต้องการพารามิเตอร์ task key',
            'project_id_required' => 'ต้องการพารามิเตอร์ ID โครงการ',
            'chat_topic_id_required' => 'ต้องการพารามิเตอร์ ID หัวข้อการสนทนา',
            'model_id_required' => 'ต้องการพารามิเตอร์ ID รุ่น',
            'file_required' => 'ต้องการพารามิเตอร์ไฟล์',
            'task_not_found' => 'ไม่พบงานหรือหมดอายุ',
            'task_not_exist' => 'งานไม่มีอยู่หรือหมดอายุแล้ว',
            'upload_audio_first' => 'กรุณาอัปโหลดไฟล์เสียงก่อน',
            'note_content_too_long' => 'เนื้อหาหมายเหตุยาวเกินไป รองรับสูงสุด 10000 ตัวอักษร ปัจจุบัน :length ตัวอักษร',
        ],
        'upload' => [
            'start_log' => 'เริ่มอัปโหลดไฟล์ ASR',
            'success_log' => 'อัปโหลดไฟล์ ASR สำเร็จ',
            'success_message' => 'อัปโหลดไฟล์สำเร็จ',
            'failed_log' => 'อัปโหลดไฟล์ ASR ล้มเหลว',
            'failed_exception' => 'อัปโหลดไฟล์ล้มเหลว: :error',
        ],
        'token' => [
            'cache_cleared' => 'เคลียร์แคช ASR Token สำเร็จ',
            'cache_not_exist' => 'แคช ASR Token ไม่มีอยู่',
            'access_token_not_configured' => 'ASR access token ยังไม่ได้กำหนดค่า',
            'sts_get_failed' => 'การรับ STS Token ล้มเหลว: temporary_credential.dir ว่างเปล่า กรุณาตรวจสอบการกำหนดค่าบริการจัดเก็บ',
            'usage_note' => 'Token นี้เฉพาะสำหรับการอัปโหลดไฟล์บันทึกเสียง ASR แบบแยกส่วน กรุณาอัปโหลดไฟล์บันทึกเสียงไปยังไดเรกทอรีที่ระบุ',
            'reuse_task_log' => 'ใช้ task key ซ้ำ รีเฟรช STS Token',
        ],
        'speech_recognition' => [
            'task_id_missing' => 'ID งานการรู้จำเสียงไม่มีอยู่',
            'request_id_missing' => 'บริการรู้จำเสียงไม่ได้คืนค่า request ID',
            'submit_failed' => 'การส่งงานแปลงเสียงล้มเหลว: :error',
            'silent_audio_error' => 'เสียงเงียบ กรุณาตรวจสอบว่าไฟล์เสียงมีเนื้อหาเสียงพูดที่ถูกต้อง',
            'internal_server_error' => 'ข้อผิดพลาดการประมวลผลภายในเซิร์ฟเวอร์ รหัสสถานะ: :code',
            'unknown_status_error' => 'การรู้จำเสียงล้มเหลว รหัสสถานะไม่ทราบ: :code',
        ],
        'directory' => [
            'invalid_asr_path' => 'ไดเรกทอรีต้องมีเส้นทาง "/asr/recordings"',
            'security_path_error' => 'เส้นทางไดเรกทอรีไม่สามารถมี ".." เพื่อเหตุผลด้านความปลอดภัย',
            'ownership_error' => 'ไดเรกทอรีไม่ได้เป็นของผู้ใช้ปัจจุบัน',
            'invalid_structure' => 'โครงสร้างไดเรกทอรี ASR ไม่ถูกต้อง',
            'invalid_structure_after_recordings' => 'โครงสร้างไดเรกทอรีไม่ถูกต้องหลังจาก "/asr/recordings"',
            'user_id_not_found' => 'ไม่พบ User ID ในเส้นทางไดเรกทอรี',
        ],
        'status' => [
            'get_file_list_failed' => 'การสอบถามสถานะ ASR: ไม่สามารถรับรายการไฟล์ได้',
        ],
        'redis' => [
            'save_task_status_failed' => 'การบันทึกสถานะงาน Redis ล้มเหลว',
        ],
    ],

    // เกี่ยวกับไดเรกทอรี
    'directory' => [
        'recordings_summary_folder' => 'สรุปการบันทึกเสียง',
    ],

    // เกี่ยวกับชื่อไฟล์
    'file_names' => [
        'recording_prefix' => 'บันทึกเสียง',
        'merged_audio_prefix' => 'ไฟล์เสียง',
        'original_recording' => 'ไฟล์บันทึกเสียงต้นฉบับ',
        'transcription_prefix' => 'ผลลัพธ์การถอดความ',
        'summary_prefix' => 'สรุปการบันทึกเสียง',
        'note_prefix' => 'บันทึกข้อความ',
    ],

    // เกี่ยวกับเนื้อหา Markdown
    'markdown' => [
        'transcription_title' => 'ผลลัพธ์การแปลงเสียงเป็นข้อความ',
        'transcription_content_title' => 'เนื้อหาการถอดความ',
        'summary_title' => 'สรุปการบันทึกเสียงด้วย AI',
        'summary_content_title' => 'เนื้อหาสรุปโดย AI',
        'task_id_label' => 'ID งาน',
        'generate_time_label' => 'เวลาที่สร้าง',
    ],

    // เกี่ยวกับข้อความแชท
    'messages' => [
        'summary_content' => ' สรุปเนื้อหา',
        'summary_content_with_note' => 'เมื่อสรุปการบันทึกเสียง โปรดอ้างอิงไฟล์บันทึกย่อในไดเรกทอรีเดียวกัน และจัดทำสรุปโดยพิจารณาจากทั้งบันทึกย่อและไฟล์บันทึกเสียง',
    ],
];
