<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'delivery_failed' => 'การส่งเหตุการณ์ล้มเหลว',
    'publisher_not_found' => 'ไม่พบผู้เผยแพร่เหตุการณ์',
    'exchange_not_found' => 'ไม่พบการแลกเปลี่ยนเหตุการณ์',
    'routing_key_invalid' => 'คีย์การกำหนดเส้นทางของเหตุการณ์ไม่ถูกต้อง',

    'consumer_execution_failed' => 'การประมวลผลผู้บริโภคเหตุการณ์ล้มเหลว',
    'consumer_not_found' => 'ไม่พบผู้บริโภคเหตุการณ์',
    'consumer_timeout' => 'หมดเวลาในการบริโภคเหตุการณ์',
    'consumer_retry_exceeded' => 'จำนวนครั้งในการลองใหม่ของผู้บริโภคเกินขีดจำกัด',
    'consumer_validation_failed' => 'การตรวจสอบผู้บริโภคเหตุการณ์ล้มเหลว',

    'data_serialization_failed' => 'การทำให้เป็นอนุกรมข้อมูลเหตุการณ์ล้มเหลว',
    'data_deserialization_failed' => 'การยกเลิกการทำให้เป็นอนุกรมข้อมูลเหตุการณ์ล้มเหลว',
    'data_validation_failed' => 'การตรวจสอบข้อมูลเหตุการณ์ล้มเหลว',
    'data_format_invalid' => 'รูปแบบข้อมูลเหตุการณ์ไม่ถูกต้อง',

    'queue_connection_failed' => 'การเชื่อมต่อคิวเหตุการณ์ล้มเหลว',
    'queue_not_found' => 'ไม่พบคิวเหตุการณ์',
    'queue_full' => 'คิวเหตุการณ์เต็ม',
    'queue_permission_denied' => 'ไม่มีสิทธิ์เข้าถึงคิวเหตุการณ์',

    'processing_interrupted' => 'การประมวลผลเหตุการณ์ถูกขัดจังหวะ',
    'processing_deadlock' => 'การประมวลผลเหตุการณ์เกิดทางตัน',
    'processing_resource_exhausted' => 'ทรัพยากรการประมวลผลเหตุการณ์หมด',
    'processing_dependency_failed' => 'ข้อผิดพลาดการพึ่งพาการประมวลผลเหตุการณ์',

    'configuration_invalid' => 'การกำหนดค่าเหตุการณ์ไม่ถูกต้อง',
    'handler_not_registered' => 'ยังไม่ได้ลงทะเบียนตัวจัดการเหตุการณ์',
    'listener_registration_failed' => 'การลงทะเบียนผู้ฟังเหตุการณ์ล้มเหลว',

    'system_unavailable' => 'ระบบเหตุการณ์ไม่พร้อมใช้งาน',
    'system_overloaded' => 'ระบบเหตุการณ์มีภาระเกิน',
    'system_maintenance' => 'ระบบเหตุการณ์อยู่ระหว่างการบำรุงรักษา',

    'points' => [
        'insufficient' => 'คะแนนไม่เพียงพอ',
    ],
    'task' => [
        'pending' => 'งานรอดำเนินการ',
        'stop' => 'งานหยุด',
    ],
    'credit' => [
        'insufficient_limit' => 'วงเงินเครดิตไม่เพียงพอ',
    ],
];
