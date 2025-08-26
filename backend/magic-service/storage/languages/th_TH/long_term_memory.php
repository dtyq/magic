<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => 'การดำเนินการหน่วยความจำระยะยาวล้มเหลว',
    'prompt_file_not_found' => 'ไม่พบไฟล์พรอมต์: :path',
    'not_found' => 'ไม่พบหน่วยความจำ',
    'creation_failed' => 'การสร้างหน่วยความจำล้มเหลว',
    'update_failed' => 'การอัปเดตหน่วยความจำล้มเหลว',
    'deletion_failed' => 'การลบหน่วยความจำล้มเหลว',
    'evaluation' => [
        'llm_request_failed' => 'คำขอประเมินหน่วยความจำล้มเหลว',
        'llm_response_parse_failed' => 'การแยกวิเคราะห์การตอบสนองการประเมินหน่วยความจำล้มเหลว',
        'score_parse_failed' => 'การแยกวิเคราะห์คะแนนการประเมินหน่วยความจำล้มเหลว',
    ],
    'entity' => [
        'content_too_long' => 'ความยาวเนื้อหาหน่วยความจำต้องไม่เกิน 65535 ตัวอักษร',
        'pending_content_too_long' => 'ความยาวเนื้อหาหน่วยความจำที่รอการเปลี่ยนแปลงต้องไม่เกิน 65535 ตัวอักษร',
        'enabled_status_restriction' => 'เฉพาะหน่วยความจำที่ใช้งานแล้วเท่านั้นที่สามารถเปิดหรือปิดใช้งานได้',
        'user_memory_limit_exceeded' => 'ถึงขีดจำกัดหน่วยความจำของผู้ใช้แล้ว (20 หน่วยความจำ)',
    ],
    'api' => [
        'validation_failed' => 'การตรวจสอบพารามิเตอร์ล้มเหลว: :errors',
        'memory_not_belong_to_user' => 'ไม่พบหน่วยความจำหรือไม่มีสิทธิ์เข้าถึง',
        'partial_memory_not_belong_to_user' => 'ไม่พบหน่วยความจำบางส่วนหรือไม่มีสิทธิ์เข้าถึง',
        'accept_memories_failed' => 'การรับข้อเสนอแนะหน่วยความจำล้มเหลว: :error',
        'memory_created_successfully' => 'สร้างหน่วยความจำสำเร็จ',
        'memory_updated_successfully' => 'อัปเดตหน่วยความจำสำเร็จ',
        'memory_deleted_successfully' => 'ลบหน่วยความจำสำเร็จ',
        'memory_reinforced_successfully' => 'เสริมสร้างหน่วยความจำสำเร็จ',
        'memories_batch_reinforced_successfully' => 'เสริมสร้างหน่วยความจำแบบกลุ่มสำเร็จ',
        'memories_accepted_successfully' => 'รับข้อเสนอแนะหน่วยความจำ :count รายการสำเร็จ',
        'memories_rejected_successfully' => 'ปฏิเสธและลบข้อเสนอแนะหน่วยความจำ :count รายการสำเร็จ',
        'batch_process_memories_failed' => 'การประมวลผลข้อเสนอแนะหน่วยความจำแบบกลุ่มล้มเหลว',
        'batch_action_memories_failed' => 'การ:actionข้อเสนอแนะหน่วยความจำแบบกลุ่มล้มเหลว: :error',
        'user_manual_edit_explanation' => 'ผู้ใช้แก้ไขเนื้อหาหน่วยความจำด้วยตนเอง',
        'content_auto_compressed_explanation' => 'เนื้อหายาวเกินไป บีบอัดอัตโนมัติ',
        'parameter_validation_failed' => 'การตรวจสอบพารามิเตอร์ล้มเหลว: :errors',
        'action_accept' => 'ยอมรับ',
        'action_reject' => 'ปฏิเสธ',
    ],
];
