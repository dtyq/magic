<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'resource' => [
        'admin' => 'Admin',
        'admin_ai' => 'AI Management',
        'admin_safe' => 'Security & Permission',
        'safe_sub_admin' => 'Sub Admin',
        'ai_model' => 'AI Model',
        'ai_image' => 'AI Image',
        'console' => 'Console',
        'api' => 'API',
        'api_assistant' => 'API Assistant',
        'platform' => 'Platform',
        'platform_setting' => 'System Settings',
        'platform_setting_maintenance' => 'Maintenance',
    ],
    'operation' => [
        'query' => 'Query',
        'edit' => 'Edit',
    ],
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
    ],
];
