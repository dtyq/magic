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
        'env' => 'ตัวแปรสภาพแวดล้อม',
        'oauth2_config' => 'การกำหนดค่า OAuth2',
        'client_id' => 'ID ลูกค้า',
        'client_secret' => 'รหัสลับลูกค้า',
        'client_url' => 'URL ลูกค้า',
        'scope' => 'ขอบเขต',
        'authorization_url' => 'URL การอนุญาต',
        'authorization_content_type' => 'ประเภทเนื้อหาการอนุญาต',
        'issuer_url' => 'URL ผู้ออก',
        'redirect_uri' => 'URI เปลี่ยนเส้นทาง',
        'use_pkce' => 'ใช้ PKCE',
        'response_type' => 'ประเภทการตอบสนอง',
        'grant_type' => 'ประเภทการอนุญาต',
        'additional_params' => 'พารามิเตอร์เพิ่มเติม',
        'created_at' => 'สร้างเมื่อ',
        'updated_at' => 'อัปเดตเมื่อ',
    ],
    'auth_type' => [
        'none' => 'ไม่มีการตรวจสอบสิทธิ์',
        'oauth2' => 'การตรวจสอบสิทธิ์ OAuth2',
    ],

    // ข้อความแสดงข้อผิดพลาด
    'validate_failed' => 'การตรวจสอบล้มเหลว',
    'not_found' => 'ไม่พบข้อมูล',

    // ข้อผิดพลาดที่เกี่ยวข้องกับบริการ
    'service' => [
        'already_exists' => 'บริการ MCP มีอยู่แล้ว',
        'not_enabled' => 'บริการ MCP ไม่ได้เปิดใช้งาน',
    ],

    // ข้อผิดพลาดที่เกี่ยวข้องกับเซิร์ฟเวอร์
    'server' => [
        'not_support_check_status' => 'ไม่รองรับการตรวจสอบสถานะเซิร์ฟเวอร์ประเภทนี้',
    ],

    // ข้อผิดพลาดความสัมพันธ์ของทรัพยากร
    'rel' => [
        'not_found' => 'ไม่พบทรัพยากรที่เกี่ยวข้อง',
        'not_enabled' => 'ทรัพยากรที่เกี่ยวข้องไม่ได้เปิดใช้งาน',
    ],
    'rel_version' => [
        'not_found' => 'ไม่พบเวอร์ชันทรัพยากรที่เกี่ยวข้อง',
    ],

    // ข้อผิดพลาดเครื่องมือ
    'tool' => [
        'execute_failed' => 'การดำเนินการเครื่องมือล้มเหลว',
    ],

    // ข้อผิดพลาดการตรวจสอบสิทธิ์ OAuth2
    'oauth2' => [
        'authorization_url_generation_failed' => 'ไม่สามารถสร้าง URL การอนุญาต OAuth2',
        'callback_handling_failed' => 'ไม่สามารถจัดการ callback OAuth2',
        'token_refresh_failed' => 'ไม่สามารถรีเฟรช token OAuth2',
        'invalid_response' => 'ผู้ให้บริการ OAuth2 ตอบกลับไม่ถูกต้อง',
        'provider_error' => 'ผู้ให้บริการ OAuth2 ตอบกลับข้อผิดพลาด',
        'missing_access_token' => 'ไม่ได้รับ access token จากผู้ให้บริการ OAuth2',
        'invalid_service_configuration' => 'การกำหนดค่าบริการ OAuth2 ไม่ถูกต้อง',
        'missing_configuration' => 'การกำหนดค่า OAuth2 ขาดหายไป',
        'not_authenticated' => 'ไม่พบการตรวจสอบสิทธิ์ OAuth2 สำหรับบริการนี้',
        'no_refresh_token' => 'ไม่มี refresh token สำหรับการรีเฟรช token',
        'binding' => [
            'code_empty' => 'รหัสการอนุญาตไม่สามารถเว้นว่างได้',
            'state_empty' => 'พารามิเตอร์สถานะไม่สามารถเว้นว่างได้',
            'mcp_server_code_empty' => 'รหัสเซิร์ฟเวอร์ MCP ไม่สามารถเว้นว่างได้',
        ],
    ],

    // ข้อผิดพลาดในการตรวจสอบคำสั่ง
    'command' => [
        'not_allowed' => 'คำสั่งที่ไม่รองรับ ":command" ปัจจุบันรองรับเฉพาะ: :allowed_commands',
    ],

    // ข้อผิดพลาดในการตรวจสอบฟิลด์ที่จำเป็น
    'required_fields' => [
        'missing' => 'ฟิลด์ที่จำเป็นขาดหายไป: :fields',
        'empty' => 'ฟิลด์ที่จำเป็นไม่สามารถเว้นว่างได้: :fields',
    ],

    // ข้อผิดพลาดที่เกี่ยวข้องกับ STDIO executor
    'executor' => [
        'stdio' => [
            'connection_failed' => 'การเชื่อมต่อ STDIO executor ล้มเหลว',
            'access_denied' => 'ฟังก์ชัน STDIO executor ไม่รองรับในขณะนี้',
        ],
        'http' => [
            'connection_failed' => 'การเชื่อมต่อ HTTP executor ล้มเหลว',
        ],
    ],
];
