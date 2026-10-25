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
        'icon' => 'Icon',
        'status' => 'Status',
        'external_sse_url' => 'MCP Service URL',
        'url' => 'URL',
        'command' => 'Command',
        'arguments' => 'Arguments',
        'headers' => 'Headers',
        'env' => 'Environment Variables',
        'oauth2_config' => 'OAuth2 Configuration',
        'mcp_authorization_config' => 'MCP Standard Authorization Configuration',
        'client_id' => 'Client ID',
        'client_secret' => 'Client Secret',
        'client_url' => 'Client URL',
        'scope' => 'Scope',
        'authorization_url' => 'Authorization URL',
        'authorization_content_type' => 'Authorization Content Type',
        'authorization_method' => 'Authorization Method',
        'issuer_url' => 'Issuer URL',
        'resource_metadata_url' => 'Resource Metadata URL',
        'authorization_server_url' => 'Authorization Server URL',
        'authorization_endpoint' => 'Authorization Endpoint',
        'token_endpoint' => 'Token Endpoint',
        'registration_endpoint' => 'Client Registration Endpoint',
        'registration_mode' => 'Client Registration Mode',
        'client_metadata_url' => 'Client Metadata URL',
        'token_endpoint_auth_method' => 'Token Endpoint Authentication Method',
        'application_type' => 'Application Type',
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
        'mcp_authorization' => 'MCP standard authorization',
    ],

    // Error messages
    'validate_failed' => 'Validation failed',
    'not_found' => 'Data not found',
    'field_too_long' => ':label cannot exceed :max characters',

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

    'authorization' => [
        'discovery_failed' => 'Failed to discover MCP authorization server',
        'issuer_mismatch' => 'MCP authorization server issuer validation failed',
        'state_invalid' => 'MCP authorization state is invalid or expired',
        'token_exchange_failed' => 'Failed to exchange MCP authorization token',
        'not_configured' => 'MCP standard authorization is not configured',
    ],

    // MCP authorization capability probe
    'authorization_capability' => [
        'unsupported' => 'MCP standard authorization is not selected for this service',
        'not_configured' => 'MCP standard authorization configuration is missing',
        'resource_url_required' => 'The MCP Resource must be a complete URL',
        'invalid_server_metadata' => 'Invalid authorization server metadata',
        'missing_server_endpoints' => 'Authorization server metadata is missing required endpoints',
        'probe_failed' => 'MCP authorization capability probe failed',
        'registration' => [
            'pre_registered' => 'An administrator must pre-register the client',
            'cimd_supported' => 'The authorization server declares CIMD support',
            'cimd_unsupported' => 'The authorization server does not declare CIMD support',
            'dcr_found' => 'A dynamic client registration endpoint was discovered',
            'dcr_missing' => 'No dynamic client registration endpoint was discovered',
        ],
        'warnings' => [
            'dcr_recommended' => 'Dynamic client registration is recommended; the first authorization may create a remote client.',
            'cimd_not_advertised' => 'A CIMD URL is configured, but the authorization server does not explicitly advertise CIMD support.',
            'token_auth_not_advertised' => 'The authorization server does not advertise a token endpoint authentication method; none is recommended.',
        ],
        'failure_reason' => [
            'remote_request' => 'The remote request failed',
            'configuration_or_discovery' => 'Configuration validation or authorization discovery failed',
        ],
    ],

    // MCP authorization callback page
    'authorization_callback' => [
        'title' => [
            'success' => 'Authorization completed',
            'failure' => 'Authorization failed',
        ],
        'message' => [
            'success' => 'MCP authorization is complete. You can close this page.',
            'failure' => 'The MCP authorization callback failed. Return to the original page and try again.',
        ],
        'description' => [
            'success' => 'This page will close automatically in 10 seconds. You can also return to the original page to continue.',
            'failure' => 'Check that the authorization server is configured correctly, or start the authorization flow again.',
        ],
        'countdown' => ' seconds until this page closes automatically',
        'manual_close' => 'The browser did not allow this page to close automatically. Please close it manually.',
        'close_button' => 'Close page',
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
