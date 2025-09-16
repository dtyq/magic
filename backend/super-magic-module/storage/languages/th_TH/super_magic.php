<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'fields' => [
            'code' => 'รหัส',
            'codes' => 'รายการรหัส',
            'name' => 'ชื่อ',
            'description' => 'คำอธิบาย',
            'icon' => 'ไอคอน',
            'type' => 'ประเภท',
            'enabled' => 'สถานะเปิดใช้งาน',
            'prompt' => 'Prompt',
            'tools' => 'การกำหนดค่าเครื่องมือ',
            'tool_code' => 'รหัสเครื่องมือ',
            'tool_name' => 'ชื่อเครื่องมือ',
            'tool_type' => 'ประเภทเครื่องมือ',
            // ฟิลด์ทั่วไป
            'page' => 'หน้า',
            'page_size' => 'ขนาดหน้า',
            'creator_id' => 'ID ผู้สร้าง',
        ],
        'limit_exceeded' => 'ถึงขีดจำกัด Agent แล้ว (:limit), ไม่สามารถสร้างเพิ่มได้',
        'builtin_not_allowed' => 'การดำเนินการนี้ไม่รองรับสำหรับ Agent ที่สร้างไว้แล้ว',
    ],
];
