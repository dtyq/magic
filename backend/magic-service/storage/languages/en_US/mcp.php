<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fields' => [
        'code' => 'Code',
        'name' => 'Name',
        'description' => 'Description',
        'status' => 'Status',
        'external_sse_url' => 'MCP Service URL',
        'url' => 'URL',
        'command' => 'Command',
        'arguments' => 'Arguments',
        'headers' => 'Headers',
        'env' => 'Environment Variables',
        'oauth2_config' => 'OAuth2 Configuration',
        'client_id' => 'Client ID',
        'client_secret' => 'Client Secret',
        'client_url' => 'Client URL',
        'scope' => 'Scope',
        'authorization_url' => 'Authorization URL',
        'authorization_content_type' => 'Authorization Content Type',
        'issuer_url' => 'Issuer URL',
        'redirect_uri' => 'Redirect URI',
        'use_pkce' => 'Use PKCE',
        'response_type' => 'Response Type',
        'grant_type' => 'Grant Type',
        'additional_params' => 'Additional Parameters',
        'created_at' => 'Created At',
        'updated_at' => 'Updated At',
    ],
    'auth_type' => [
        'none' => 'No Authentication',
        'oauth2' => 'OAuth2 Authentication',
    ],

    // Error messages
    'validate_failed' => 'Validation failed',
    'not_found' => 'Data not found',

    // Service related errors
    'service' => [
        'already_exists' => 'MCP service already exists',
        'not_enabled' => 'MCP service is not enabled',
    ],

    // Server related errors
    'server' => [
        'not_support_check_status' => 'This type of server status check is not supported',
    ],

    // Resource relation errors
    'rel' => [
        'not_found' => 'Related resource not found',
        'not_enabled' => 'Related resource is not enabled',
    ],
    'rel_version' => [
        'not_found' => 'Related resource version not found',
    ],

    // Tool errors
    'tool' => [
        'execute_failed' => 'Tool execution failed',
    ],

    // OAuth2 authentication errors
    'oauth2' => [
        'authorization_url_generation_failed' => 'Failed to generate OAuth2 authorization URL',
        'callback_handling_failed' => 'Failed to handle OAuth2 callback',
        'token_refresh_failed' => 'Failed to refresh OAuth2 token',
        'invalid_response' => 'Invalid response from OAuth2 provider',
        'provider_error' => 'OAuth2 provider returned an error',
        'missing_access_token' => 'No access token received from OAuth2 provider',
        'invalid_service_configuration' => 'Invalid OAuth2 service configuration',
        'missing_configuration' => 'OAuth2 configuration is missing',
        'not_authenticated' => 'OAuth2 authentication not found for this service',
        'no_refresh_token' => 'No refresh token available for token refresh',
        'binding' => [
            'code_empty' => 'Authorization code cannot be empty',
            'state_empty' => 'State parameter cannot be empty',
            'mcp_server_code_empty' => 'MCP server code cannot be empty',
        ],
    ],

    // Command validation errors
    'command' => [
        'not_allowed' => 'Unsupported command ":command", currently only supports: :allowed_commands',
    ],

    // Required fields validation errors
    'required_fields' => [
        'missing' => 'Required fields are missing: :fields',
        'empty' => 'Required fields cannot be empty: :fields',
    ],

    // STDIO executor related errors
    'executor' => [
        'stdio' => [
            'connection_failed' => 'STDIO executor connection failed',
            'access_denied' => 'STDIO executor functionality is temporarily not supported',
        ],
        'http' => [
            'connection_failed' => 'HTTP executor connection failed',
        ],
    ],
];
