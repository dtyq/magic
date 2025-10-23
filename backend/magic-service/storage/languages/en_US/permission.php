<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'resource' => [
        'admin' => 'Admin',
        'admin_plus' => 'Admin Plus',
        'admin_ai' => 'AI Management',
        'admin_plus_ai' => 'AI Management',
        'admin_safe' => 'Security & Permission',
        'safe_sub_admin' => 'Sub Admin',
        'ai_model' => 'AI Model',
        'ai_image' => 'AI Image',
        'ai_mode' => 'AI Mode',
        'console' => 'Console',
        'api' => 'API',
        'api_assistant' => 'API Assistant',
        'platform' => 'Platform',
        'platform_ai' => 'Platform AI',
        'platform_setting' => 'System Settings',
        'platform_setting_platform_info' => 'Platform Info',
        'platform_setting_maintenance' => 'Maintenance',
        'platform_organization' => 'Organization',
        'platform_organization_list' => 'Organization List',
    ],
    'operation' => [
        'query' => 'Query',
        'edit' => 'Edit',
    ],
    // Top-level generic keys for PermissionErrorCode
    'validate_failed' => 'Validation failed',
    'business_exception' => 'Business exception',
    'access_denied' => 'Access denied',
    // Organization related
    'organization_code_required' => 'Organization code is required',
    'organization_name_required' => 'Organization name is required',
    'organization_industry_type_required' => 'Organization industry type is required',
    'organization_seats_invalid' => 'Organization seats is invalid',
    'organization_code_exists' => 'Organization code already exists',
    'organization_name_exists' => 'Organization name already exists',
    'organization_not_exists' => 'Organization does not exist',
    'error' => [
        'role_name_exists' => 'Role name :name already exists',
        'role_not_found' => 'Role not found',
        'invalid_permission_key' => 'Permission key :key is invalid',
        'access_denied' => 'Access denied',
        'user_already_organization_admin' => 'User :userId is already an organization admin',
        'organization_admin_not_found' => 'Organization admin not found',
        'organization_creator_cannot_be_revoked' => 'Organization creator cannot be revoked',
        'organization_creator_cannot_be_disabled' => 'Organization creator cannot be disabled',
        'current_user_not_organization_creator' => 'Current user is not the organization creator',
        'personal_organization_cannot_grant_admin' => 'Cannot grant organization admin in a personal organization',
    ],
];
