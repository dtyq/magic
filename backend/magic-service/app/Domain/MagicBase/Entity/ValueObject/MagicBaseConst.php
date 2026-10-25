<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MagicBase\Entity\ValueObject;

final class MagicBaseConst
{
    public const ROW_STORAGE_DRIVER_MONGODB = 'mongodb';

    public const ROW_STORAGE_SEARCH_SIZE = 10000;

    public const MONGODB_COLLECTION_PREFIX = 'magicbase_rows';

    public const SCOPE_PUBLIC = 'public';

    public const SCOPE_PRIVATE_USER = 'private_user';

    public const SCOPE_PRIVATE_DEPARTMENT = 'private_department';

    public const SCOPE_PRIVATE_ORG = 'private_org';

    public const SCOPE_DISABLED = 'disabled';

    public const SUBJECT_ORGANIZATION = 'organization';

    public const SUBJECT_ORGANIZATION_CODE = 'organization_code';

    public const SUBJECT_DEPARTMENT = 'department';

    public const SUBJECT_USER = 'user';

    public const SUBJECT_ANONYMOUS = 'anonymous';

    public const PERMISSION_READ = 'read';

    public const PERMISSION_INSERT = 'insert';

    public const PERMISSION_MANAGE = 'manage';

    public const RELATION_BELONGS_TO = 'belongs_to';

    public const RELATION_HAS_ONE = 'has_one';

    public const RELATION_HAS_MANY = 'has_many';

    public const CHANGE_CREATE = 'create';

    public const CHANGE_UPDATE = 'update';

    public const CHANGE_DELETE = 'delete';

    public const TARGET_TABLE = 'table';

    public const TARGET_COLUMN = 'column';

    public const TARGET_PERMISSION = 'permission';

    public const TARGET_RELATION = 'relation';

    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_REF_API = 'api:magicbase';

    public const STATUS_ENABLED = 'enabled';

    public const STATUS_DISABLED = 'disabled';

    public const DEFAULT_TABLE_PERMISSIONS = [
        'read_scope' => self::SCOPE_PUBLIC,
        'insert_scope' => self::SCOPE_DISABLED,
    ];

    public const DEFAULT_ROW_PERMISSIONS = [
        'read_scope' => self::SCOPE_PUBLIC,
        'edit_scope' => self::SCOPE_PRIVATE_USER,
        'delete_scope' => self::SCOPE_PRIVATE_USER,
    ];

    public const DEFAULT_COLUMN_PERMISSIONS = [
        'read_scope' => self::SCOPE_PUBLIC,
        'edit_scope' => self::SCOPE_PRIVATE_USER,
    ];

    public const SCOPES = [
        self::SCOPE_PUBLIC,
        self::SCOPE_PRIVATE_USER,
        self::SCOPE_PRIVATE_DEPARTMENT,
        self::SCOPE_PRIVATE_ORG,
        self::SCOPE_DISABLED,
    ];

    public const SUBJECT_TYPES = [
        self::SUBJECT_ORGANIZATION,
        self::SUBJECT_ORGANIZATION_CODE,
        self::SUBJECT_DEPARTMENT,
        self::SUBJECT_USER,
        self::SUBJECT_ANONYMOUS,
    ];

    public const MANAGEABLE_SUBJECT_TYPES = [
        self::SUBJECT_ORGANIZATION,
        self::SUBJECT_DEPARTMENT,
        self::SUBJECT_USER,
    ];

    public const PERMISSION_LEVELS = [
        self::PERMISSION_READ,
        self::PERMISSION_INSERT,
        self::PERMISSION_MANAGE,
    ];

    public const RELATION_TYPES = [
        self::RELATION_BELONGS_TO,
        self::RELATION_HAS_ONE,
        self::RELATION_HAS_MANY,
    ];

    public const DATA_TYPES = [
        'text',
        'number',
        'datetime',
        'boolean',
        'json',
    ];
}
