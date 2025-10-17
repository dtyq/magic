<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'default_project_name' => 'New Project',
    'project_not_found' => 'Project not found',
    'project_name_already_exists' => 'Project name already exists',
    'project_access_denied' => 'Access denied to this project',
    'create_project_failed' => 'Failed to create project',
    'update_project_failed' => 'Failed to update project',
    'delete_project_failed' => 'Failed to delete project',
    'work_dir' => [
        'not_found' => 'Project work directory not found',
    ],
    'department_not_found' => 'Department not found',
    'invalid_member_type' => 'Invalid member type',
    'invalid_member_role' => 'Invalid member role',
    'update_members_failed' => 'Failed to update members',
    'member_validation_failed' => 'Member validation failed',
    'cannot_set_shortcut_for_own_project' => 'Cannot set shortcut for your own project',

    // Operation log related
    'operation_log' => [
        'not_found' => 'Operation log record not found',
    ],

    // Member type descriptions
    'member_type' => [
        'user' => 'User',
        'department' => 'Department',
    ],

    // Member status descriptions
    'member_status' => [
        'active' => 'Active',
        'inactive' => 'Inactive',
    ],

    // Member role descriptions
    'member_role' => [
        'manage' => 'Manager',
        'owner' => 'Owner',
        'editor' => 'Editor',
        'viewer' => 'Viewer',
    ],

    // Team invitation feature error messages
    'no_invite_permission' => 'You do not have permission to invite members',
    'collaboration_disabled' => 'Project collaboration is disabled',
    'invalid_permission_level' => 'Invalid permission level',
    'no_manage_permission' => 'You do not have management permission',
    'cannot_remove_creator' => 'Cannot remove project creator',
    'last_manager_cannot_be_removed' => 'At least one manager must be retained',
    'duplicate_member' => 'Member already exists',
    'member_not_found' => 'Member not found',
    'invalid_target_type' => 'Invalid target type',
    'cannot_remove_self' => 'Cannot remove yourself',
    'members_added' => 'Team members added successfully',
    'collaboration_enabled' => 'Project collaboration enabled',
    'collaboration_updated' => 'Project collaboration settings updated',
    'batch_permission_updated' => 'Batch permission updated successfully',
    'batch_members_deleted' => 'Batch members deleted successfully',
];
