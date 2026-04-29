<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Method;

final class SvcMethods
{
    public const string IPC_HELLO = 'ipc.hello';

    public const string IPC_PING = 'ipc.ping';

    public const string SERVICE_KNOWLEDGE_KNOWLEDGE_BASE = 'svc.knowledge.knowledgeBase';

    public const string SERVICE_KNOWLEDGE_TEAMSHARE = 'svc.knowledge.teamshare';

    public const string SERVICE_KNOWLEDGE_DOCUMENT = 'svc.knowledge.document';

    public const string SERVICE_KNOWLEDGE_FRAGMENT = 'svc.knowledge.fragment';

    public const string SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT = 'svc.knowledge.thirdPlatformDocument';

    public const string SERVICE_KNOWLEDGE_PROJECT_FILE = 'svc.knowledge.projectFile';

    public const string SERVICE_KNOWLEDGE_SUPER_MAGIC_AGENT = 'svc.knowledge.superMagicAgent';

    public const string SERVICE_KNOWLEDGE_KNOWLEDGE_BASE_PERMISSION = 'svc.knowledge.knowledgeBasePermission';

    public const string SERVICE_KNOWLEDGE_OCR = 'svc.knowledge.ocr';

    public const string SERVICE_PERMISSION_OPERATION_PERMISSION = 'svc.permission.operationPermission';

    public const string SERVICE_MODEL_GATEWAY_EMBEDDING = 'svc.modelGateway.embedding';

    public const string SERVICE_MODEL_GATEWAY_ACCESS_TOKEN = 'svc.modelGateway.accessToken';

    public const string SERVICE_FILE = 'svc.file';

    public const string METHOD_CREATE = 'create';

    public const string METHOD_UPDATE = 'update';

    public const string METHOD_SHOW = 'show';

    public const string METHOD_QUERIES = 'queries';

    public const string METHOD_GET_BY_THIRD_FILE_ID = 'getByThirdFileId';

    public const string METHOD_GET_ORIGINAL_FILE_LINK = 'getOriginalFileLink';

    public const string METHOD_DESTROY = 'destroy';

    public const string METHOD_REBUILD = 'rebuild';

    public const string METHOD_REBUILD_PERMISSIONS = 'rebuildPermissions';

    public const string METHOD_START_VECTOR = 'startVector';

    public const string METHOD_MANAGEABLE = 'manageable';

    public const string METHOD_MANAGEABLE_PROGRESS = 'manageableProgress';

    public const string METHOD_SAVE_PROCESS = 'saveProcess';

    public const string METHOD_REPAIR_SOURCE_BINDINGS = 'repairThirdFileMappings';

    public const string METHOD_REBUILD_CLEANUP = 'rebuildCleanup';

    public const string METHOD_SYNC = 'sync';

    public const string METHOD_RE_VECTORIZED_BY_THIRD_FILE_ID = 'reVectorizedByThirdFileId';

    public const string METHOD_PREVIEW = 'preview';

    public const string METHOD_PREVIEW_HTTP = 'preview_http';

    public const string METHOD_SIMILARITY = 'similarity';

    public const string METHOD_SIMILARITY_HTTP = 'similarity_http';

    public const string METHOD_QUERIES_HTTP = 'queries_http';

    public const string METHOD_RUNTIME_SIMILARITY = 'runtimeSimilarity';

    public const string METHOD_SIMILARITY_BY_AGENT = 'similarityByAgent';

    public const string METHOD_RUNTIME_CREATE = 'runtimeCreate';

    public const string METHOD_RUNTIME_DESTROY_BY_BUSINESS_ID = 'runtimeDestroyByBusinessId';

    public const string METHOD_RUNTIME_DESTROY_BY_METADATA_FILTER = 'runtimeDestroyByMetadataFilter';

    public const string METHOD_COUNT_BY_KNOWLEDGE_BASE_CODES = 'countByKnowledgeBaseCodes';

    public const string METHOD_PROVIDERS_LIST = 'providers.list';

    public const string METHOD_COMPUTE = 'compute';

    public const string METHOD_GET = 'get';

    public const string METHOD_GET_LINK = 'getLink';

    public const string METHOD_STAT = 'stat';

    public const string METHOD_RESOLVE = 'resolve';

    public const string METHOD_RESOLVE_NODE = 'resolveNode';

    public const string METHOD_LIST_BY_PROJECT = 'listByProject';

    public const string METHOD_EXPAND = 'expand';

    public const string METHOD_NODES = 'nodes';

    public const string METHOD_LIST_WORKSPACES = 'listWorkspaces';

    public const string METHOD_LIST_PROJECTS = 'listProjects';

    public const string METHOD_LIST_TREE_NODES = 'listTreeNodes';

    public const string METHOD_META = 'meta';

    public const string METHOD_LIST_KNOWLEDGE_BASES = 'listKnowledgeBases';

    public const string METHOD_LIST_MANAGEABLE_CODES = 'listManageableCodes';

    public const string METHOD_LIST_ACCESSIBLE_CODES = 'listAccessibleCodes';

    public const string METHOD_LIST_OPERATIONS = 'listOperations';

    public const string METHOD_INITIALIZE = 'initialize';

    public const string METHOD_GRANT_OWNER = 'grantOwner';

    public const string METHOD_CLEANUP = 'cleanup';

    public const string METHOD_CHECK_OFFICIAL_ORGANIZATION_MEMBER = 'checkOfficialOrganizationMember';

    public const string METHOD_NOTIFY_CHANGE = 'notifyChange';

    public const string METHOD_CONFIG = 'config';

    public const string METHOD_REPORT_USAGE = 'reportUsage';

    public const string METHOD_ACCESS_OWNER = 'accessOwner';

    public const string METHOD_DELETE_BY_RESOURCE = 'deleteByResource';

    private function __construct()
    {
    }
}
