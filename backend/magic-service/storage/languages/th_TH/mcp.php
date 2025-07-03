<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fields' => [
        'code' => 'รหัส',
        'name' => 'ชื่อ',
        'description' => 'คำอธิบาย',
        'status' => 'สถานะ',
        'external_sse_url' => 'URL บริการ MCP',
        'url' => 'URL',
        'command' => 'คำสั่ง',
        'arguments' => 'อาร์กิวเมนต์',
        'headers' => 'ส่วนหัว',
        'oauth2_config' => 'การกำหนดค่า OAuth2',
        'client_id' => 'ID ลูกค้า',
        'client_secret' => 'รหัสลับลูกค้า',
        'client_url' => 'URL ลูกค้า',
        'scope' => 'ขอบเขต',
        'authorization_url' => 'URL การอนุญาต',
        'authorization_content_type' => 'ประเภทเนื้อหาการอนุญาต',
        'created_at' => 'สร้างเมื่อ',
        'updated_at' => 'อัปเดตเมื่อ',
    ],
    'auth_type' => [
        'none' => 'ไม่มีการตรวจสอบสิทธิ์',
        'oauth2' => 'การตรวจสอบสิทธิ์ OAuth2',
    ],
];
