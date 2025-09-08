<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Chat\Service\MagicAgentEventAppService;
use App\Application\Chat\Service\SessionAppService;
use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\MysqlStringCache;
use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\StringCacheInterface;
use App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor\PHPExecutor;
use App\Application\Flow\ExecuteManager\NodeRunner\Code\CodeExecutor\PythonExecutor;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\BaseMessageAttachmentHandler;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\MessageAttachmentHandlerInterface;
use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\ExternalFileDocumentFileStrategyDriver;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ExternalFileDocumentFileStrategyInterface;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ThirdPlatformDocumentFileStrategyInterface;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\ThirdPlatformDocumentFileStrategyDriver;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\BaseKnowledgeBaseStrategy;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\BaseFullTextSimilaritySearch;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\BaseGraphSimilaritySearch;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\BaseHybridSimilaritySearch;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\BaseSemanticSimilaritySearch;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\FullTextSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\GraphSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\HybridSimilaritySearchInterface;
use App\Application\KnowledgeBase\VectorDatabase\Similarity\Driver\SemanticSimilaritySearchInterface;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentMCP;
use App\Application\MCP\SupperMagicMCP\SupperMagicAgentMCPInterface;
use App\Application\MCP\Utils\MCPExecutor\ExternalHttpExecutor;
use App\Application\MCP\Utils\MCPExecutor\ExternalHttpExecutorInterface;
use App\Application\MCP\Utils\MCPExecutor\ExternalStdioExecutor;
use App\Application\MCP\Utils\MCPExecutor\ExternalStdioExecutorInterface;
use App\Application\ModelGateway\Component\Points\PointComponent;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Admin\Repository\Persistence\AdminGlobalSettingsRepository;
use App\Domain\Agent\Repository\Facade\AgentRepositoryInterface;
use App\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\Agent\Repository\Facade\MagicBotThirdPlatformChatRepositoryInterface;
use App\Domain\Agent\Repository\Persistence\AgentRepository;
use App\Domain\Agent\Repository\Persistence\AgentVersionRepository;
use App\Domain\Agent\Repository\Persistence\MagicBotThirdPlatformChatRepository;
use App\Domain\Authentication\Repository\ApiKeyProviderRepository;
use App\Domain\Authentication\Repository\Facade\ApiKeyProviderRepositoryInterface;
use App\Domain\Authentication\Repository\Facade\AuthenticationRepositoryInterface;
use App\Domain\Authentication\Repository\Implement\AuthenticationRepository;
use App\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessageInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\UnknowChatMessage;
use App\Domain\Chat\Event\Agent\AgentExecuteInterface;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatFileRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatMessageVersionsRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatTopicRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicFriendRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\MagicChatConversationRepository;
use App\Domain\Chat\Repository\Persistence\MagicChatFileRepository;
use App\Domain\Chat\Repository\Persistence\MagicChatSeqRepository;
use App\Domain\Chat\Repository\Persistence\MagicChatTopicRepository;
use App\Domain\Chat\Repository\Persistence\MagicContactIdMappingRepository;
use App\Domain\Chat\Repository\Persistence\MagicFriendRepository;
use App\Domain\Chat\Repository\Persistence\MagicMessageRepository;
use App\Domain\Chat\Repository\Persistence\MagicMessageVersionsRepository;
use App\Domain\Chat\Service\MessageContentProvider;
use App\Domain\Chat\Service\MessageContentProviderInterface;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicDepartmentRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserIdRelationRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\MagicAccountRepository;
use App\Domain\Contact\Repository\Persistence\MagicDepartmentRepository;
use App\Domain\Contact\Repository\Persistence\MagicDepartmentUserRepository;
use App\Domain\Contact\Repository\Persistence\MagicUserIdRelationRepository;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Domain\Contact\Repository\Persistence\MagicUserSettingRepository;
use App\Domain\Contact\Service\Facade\MagicUserDomainExtendInterface;
use App\Domain\Contact\Service\MagicUserDomainExtendService;
use App\Domain\File\Repository\Persistence\CloudFileRepository;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowApiKeyRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowCacheRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowDraftRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowExecuteLogRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowMemoryHistoryRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowMultiModalLogRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowPermissionRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowToolSetRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowTriggerTestcaseRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowVersionRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowWaitMessageRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\MagicFlowAIModelRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowApiKeyRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowCacheRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowDraftRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowExecuteLogRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowMemoryHistoryRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowMultiModalLogRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowPermissionRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowToolSetRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowTriggerTestcaseRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowVersionRepository;
use App\Domain\Flow\Repository\Persistence\MagicFlowWaitMessageRepository;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\Group\Repository\Persistence\MagicGroupRepository;
use App\Domain\ImageGenerate\Contract\FontProviderInterface;
use App\Domain\ImageGenerate\Contract\ImageEnhancementProcessorInterface;
use App\Domain\ImageGenerate\Contract\WatermarkConfigInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ExternalDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseDocumentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Persistence\KnowledgeBaseBaseRepository;
use App\Domain\KnowledgeBase\Repository\Persistence\KnowledgeBaseDocumentRepository;
use App\Domain\KnowledgeBase\Repository\Persistence\KnowledgeBaseFragmentRepository;
use App\Domain\LongTermMemory\Repository\LongTermMemoryRepositoryInterface;
use App\Domain\MCP\Repository\Facade\MCPServerRepositoryInterface;
use App\Domain\MCP\Repository\Facade\MCPServerToolRepositoryInterface;
use App\Domain\MCP\Repository\Facade\MCPUserSettingRepositoryInterface;
use App\Domain\MCP\Repository\Persistence\MCPServerRepository;
use App\Domain\MCP\Repository\Persistence\MCPServerToolRepository;
use App\Domain\MCP\Repository\Persistence\MCPUserSettingRepository;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\Domain\Mode\Repository\Persistence\ModeGroupRelationRepository;
use App\Domain\Mode\Repository\Persistence\ModeGroupRepository;
use App\Domain\Mode\Repository\Persistence\ModeRepository;
use App\Domain\ModelGateway\Repository\Facade\AccessTokenRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\ApplicationRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\ModelConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\MsgLogRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\OrganizationConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Facade\UserConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\AccessTokenRepository;
use App\Domain\ModelGateway\Repository\Persistence\ApplicationRepository;
use App\Domain\ModelGateway\Repository\Persistence\ModelConfigRepository;
use App\Domain\ModelGateway\Repository\Persistence\MsgLogRepository;
use App\Domain\ModelGateway\Repository\Persistence\OrganizationConfigRepository;
use App\Domain\ModelGateway\Repository\Persistence\UserConfigRepository;
use App\Domain\OrganizationEnvironment\Entity\Facade\OpenPlatformConfigInterface;
use App\Domain\OrganizationEnvironment\Entity\Item\OpenPlatformConfigItem;
use App\Domain\OrganizationEnvironment\Repository\Facade\EnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsEnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsPlatformRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\MagicEnvironmentsRepository;
use App\Domain\OrganizationEnvironment\Repository\OrganizationsEnvironmentRepository;
use App\Domain\OrganizationEnvironment\Repository\OrganizationsPlatformRepository;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\OperationPermissionRepository;
use App\Domain\Provider\Repository\Facade\MagicProviderAndModelsInterface;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderOriginalModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\MagicProviderAndModelsRepository;
use App\Domain\Provider\Repository\Persistence\ProviderConfigRepository;
use App\Domain\Provider\Repository\Persistence\ProviderModelRepository;
use App\Domain\Provider\Repository\Persistence\ProviderOriginalModelRepository;
use App\Domain\Provider\Repository\Persistence\ProviderRepository;
use App\Domain\Provider\Service\ModelFilter\DefaultPackageFilter;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Token\Item\MagicTokenExtra;
use App\Domain\Token\Repository\Facade\MagicTokenExtraInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Domain\Token\Repository\Persistence\MagicMagicTokenRepository;
use App\Infrastructure\Core\Broadcast\Publisher\AmqpPublisher;
use App\Infrastructure\Core\Broadcast\Publisher\PublisherInterface;
use App\Infrastructure\Core\Broadcast\Subscriber\AmqpSubscriber;
use App\Infrastructure\Core\Broadcast\Subscriber\SubscriberInterface;
use App\Infrastructure\Core\Contract\Authorization\BaseFlowOpenApiCheck;
use App\Infrastructure\Core\Contract\Authorization\FlowOpenApiCheckInterface;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PHPExecutorInterface;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PythonExecutorInterface;
use App\Infrastructure\Core\Contract\Session\SessionInterface;
use App\Infrastructure\Core\DataIsolation\BaseHandleDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\HandleDataIsolationInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Embeddings\DocumentSplitter\DocumentSplitterInterface;
use App\Infrastructure\Core\Embeddings\DocumentSplitter\OdinRecursiveCharacterTextSplitter;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\EmbeddingGeneratorInterface;
use App\Infrastructure\Core\Embeddings\EmbeddingGenerator\OdinEmbeddingGenerator;
use App\Infrastructure\Core\File\Parser\Driver\ExcelFileParserDriver;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\ExcelFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\OcrFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\PdfFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\TextFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\WordFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\OcrFileParserDriver;
use App\Infrastructure\Core\File\Parser\Driver\PdfFileParserDriver;
use App\Infrastructure\Core\File\Parser\Driver\TextFileParserDriver;
use App\Infrastructure\Core\File\Parser\Driver\WordFileParserDriver;
use App\Infrastructure\Core\HighAvailability\Interface\EndpointProviderInterface;
use App\Infrastructure\Core\HighAvailability\Service\ModelGatewayEndpointProvider;
use App\Infrastructure\Core\TempAuth\RedisTempAuth;
use App\Infrastructure\Core\TempAuth\TempAuthInterface;
use App\Infrastructure\ExternalAPI\Sms\SmsInterface;
use App\Infrastructure\ExternalAPI\Sms\TemplateInterface;
use App\Infrastructure\ExternalAPI\Sms\Volcengine\Template;
use App\Infrastructure\ExternalAPI\Sms\Volcengine\VolceApiClient;
use App\Infrastructure\ImageGenerate\DefaultFontProvider;
use App\Infrastructure\ImageGenerate\DefaultWatermarkConfig;
use App\Infrastructure\ImageGenerate\NullImageEnhancementProcessor;
use App\Infrastructure\Repository\LongTermMemory\MySQLLongTermMemoryRepository;
use App\Infrastructure\Util\Auth\Permission\Permission;
use App\Infrastructure\Util\Auth\Permission\PermissionInterface;
use App\Infrastructure\Util\Client\SimpleClientFactory;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Locker\RedisLocker;
use App\Infrastructure\Util\OrganizationEnvironment\Repository\OrganizationRepository;
use App\Infrastructure\Util\Permission\Repository\OrganizationAdminRepository;
use App\Infrastructure\Util\Permission\Repository\RoleRepository;
use App\Interfaces\MCP\Facade\HttpTransportHandler\ApiKeyProviderAuthenticator;
use Dtyq\PhpMcp\Shared\Auth\AuthenticatorInterface;
use Hyperf\Config\ProviderConfig;
use Hyperf\Crontab\Strategy\CoroutineStrategy;
use Hyperf\Crontab\Strategy\StrategyInterface;
use Hyperf\HttpServer\Server;
use Hyperf\SocketIOServer\BaseNamespace;
use Hyperf\SocketIOServer\NamespaceInterface;
use Hyperf\SocketIOServer\Room\AdapterInterface;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\DistributedSidProvider;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Psr\Http\Client\ClientInterface;

$dependencies = [
    SmsInterface::class => VolceApiClient::class,
    LockerInterface::class => RedisLocker::class,
    MagicTokenRepositoryInterface::class => MagicMagicTokenRepository::class,
    TemplateInterface::class => Template::class,

    // core
    ThirdPlatformDataIsolationManagerInterface::class => BaseThirdPlatformDataIsolationManager::class,
    DocumentSplitterInterface::class => OdinRecursiveCharacterTextSplitter::class,
    TempAuthInterface::class => RedisTempAuth::class,
    HandleDataIsolationInterface::class => BaseHandleDataIsolation::class,
    FlowOpenApiCheckInterface::class => BaseFlowOpenApiCheck::class,
    MessageAttachmentHandlerInterface::class => BaseMessageAttachmentHandler::class,

    // magic-chat
    MagicChatConversationRepositoryInterface::class => MagicChatConversationRepository::class,
    MagicMessageRepositoryInterface::class => MagicMessageRepository::class,
    MagicChatSeqRepositoryInterface::class => MagicChatSeqRepository::class,
    MagicChatTopicRepositoryInterface::class => MagicChatTopicRepository::class,
    MagicContactIdMappingRepositoryInterface::class => MagicContactIdMappingRepository::class,
    MessageContentProviderInterface::class => MessageContentProvider::class,
    OrganizationsPlatformRepositoryInterface::class => OrganizationsPlatformRepository::class,
    OpenPlatformConfigInterface::class => OpenPlatformConfigItem::class,
    MagicChatMessageVersionsRepositoryInterface::class => MagicMessageVersionsRepository::class,
    SuperAgentMessageInterface::class => UnknowChatMessage::class,
    // socket-io的发布订阅改为rabbitmq实现,但是房间还是用redis
    AdapterInterface::class => RedisAdapter::class,
    SidProviderInterface::class => DistributedSidProvider::class,
    NamespaceInterface::class => BaseNamespace::class,

    // agent
    AgentRepositoryInterface::class => AgentRepository::class,
    AgentVersionRepositoryInterface::class => AgentVersionRepository::class,

    // magic-flow
    MagicFlowRepositoryInterface::class => MagicFlowRepository::class,
    MagicFlowDraftRepositoryInterface::class => MagicFlowDraftRepository::class,
    MagicFlowVersionRepositoryInterface::class => MagicFlowVersionRepository::class,
    MagicFlowTriggerTestcaseRepositoryInterface::class => MagicFlowTriggerTestcaseRepository::class,
    MagicFlowMemoryHistoryRepositoryInterface::class => MagicFlowMemoryHistoryRepository::class,
    MagicFlowExecuteLogRepositoryInterface::class => MagicFlowExecuteLogRepository::class,
    MagicFlowAIModelRepositoryInterface::class => MagicFlowAIModelRepository::class,
    MagicFlowPermissionRepositoryInterface::class => MagicFlowPermissionRepository::class,
    MagicFlowApiKeyRepositoryInterface::class => MagicFlowApiKeyRepository::class,
    MagicFlowToolSetRepositoryInterface::class => MagicFlowToolSetRepository::class,
    MagicFlowWaitMessageRepositoryInterface::class => MagicFlowWaitMessageRepository::class,
    MagicFlowMultiModalLogRepositoryInterface::class => MagicFlowMultiModalLogRepository::class,
    MagicFlowCacheRepositoryInterface::class => MagicFlowCacheRepository::class,
    StringCacheInterface::class => MysqlStringCache::class,

    // knowledge-base
    KnowledgeBaseRepositoryInterface::class => KnowledgeBaseBaseRepository::class,
    KnowledgeBaseDocumentRepositoryInterface::class => KnowledgeBaseDocumentRepository::class,
    KnowledgeBaseFragmentRepositoryInterface::class => KnowledgeBaseFragmentRepository::class,

    // vector
    SemanticSimilaritySearchInterface::class => BaseSemanticSimilaritySearch::class,
    FullTextSimilaritySearchInterface::class => BaseFullTextSimilaritySearch::class,
    HybridSimilaritySearchInterface::class => BaseHybridSimilaritySearch::class,
    GraphSimilaritySearchInterface::class => BaseGraphSimilaritySearch::class,

    // code
    PHPExecutorInterface::class => PHPExecutor::class,
    PythonExecutorInterface::class => PythonExecutor::class,

    // magic-bot
    MagicBotThirdPlatformChatRepositoryInterface::class => MagicBotThirdPlatformChatRepository::class,

    // provider
    ProviderRepositoryInterface::class => ProviderRepository::class,
    ProviderConfigRepositoryInterface::class => ProviderConfigRepository::class,
    ProviderModelRepositoryInterface::class => ProviderModelRepository::class,
    ProviderOriginalModelRepositoryInterface::class => ProviderOriginalModelRepository::class,
    MagicProviderAndModelsInterface::class => MagicProviderAndModelsRepository::class,
    // mcp
    MCPServerRepositoryInterface::class => MCPServerRepository::class,
    MCPServerToolRepositoryInterface::class => MCPServerToolRepository::class,
    AuthenticatorInterface::class => ApiKeyProviderAuthenticator::class,
    MCPUserSettingRepositoryInterface::class => MCPUserSettingRepository::class,
    SupperMagicAgentMCPInterface::class => SupperMagicAgentMCP::class,
    ExternalStdioExecutorInterface::class => ExternalStdioExecutor::class,
    ExternalHttpExecutorInterface::class => ExternalHttpExecutor::class,

    // api-key
    ApiKeyProviderRepositoryInterface::class => ApiKeyProviderRepository::class,

    // magic-api
    ApplicationRepositoryInterface::class => ApplicationRepository::class,
    ModelConfigRepositoryInterface::class => ModelConfigRepository::class,
    AccessTokenRepositoryInterface::class => AccessTokenRepository::class,
    OrganizationConfigRepositoryInterface::class => OrganizationConfigRepository::class,
    UserConfigRepositoryInterface::class => UserConfigRepository::class,
    MsgLogRepositoryInterface::class => MsgLogRepository::class,

    // embeddings
    EmbeddingGeneratorInterface::class => OdinEmbeddingGenerator::class,

    // rerank

    // permission
    OperationPermissionRepositoryInterface::class => OperationPermissionRepository::class,
    RoleRepositoryInterface::class => RoleRepository::class,
    OrganizationAdminRepositoryInterface::class => OrganizationAdminRepository::class,

    // system
    ClientInterface::class => SimpleClientFactory::class,
    StrategyInterface::class => CoroutineStrategy::class,

    // contact
    MagicUserRepositoryInterface::class => MagicUserRepository::class,
    MagicFriendRepositoryInterface::class => MagicFriendRepository::class,
    MagicAccountRepositoryInterface::class => MagicAccountRepository::class,
    MagicUserIdRelationRepositoryInterface::class => MagicUserIdRelationRepository::class,
    MagicDepartmentUserRepositoryInterface::class => MagicDepartmentUserRepository::class,
    MagicDepartmentRepositoryInterface::class => MagicDepartmentRepository::class,
    MagicUserSettingRepositoryInterface::class => MagicUserSettingRepository::class,
    MagicUserDomainExtendInterface::class => MagicUserDomainExtendService::class,

    // 认证体系

    EnvironmentRepositoryInterface::class => MagicEnvironmentsRepository::class,
    OrganizationsEnvironmentRepositoryInterface::class => OrganizationsEnvironmentRepository::class,

    // 组织管理
    OrganizationRepositoryInterface::class => OrganizationRepository::class,

    // 群组
    MagicGroupRepositoryInterface::class => MagicGroupRepository::class,

    // 聊天文件
    MagicChatFileRepositoryInterface::class => MagicChatFileRepository::class,

    AuthenticationRepositoryInterface::class => AuthenticationRepository::class,
    CloudFileRepositoryInterface::class => CloudFileRepository::class,

    // 登录校验
    SessionInterface::class => SessionAppService::class,

    // token 扩展字段
    MagicTokenExtraInterface::class => MagicTokenExtra::class,
    // 助理执行事件
    AgentExecuteInterface::class => MagicAgentEventAppService::class,

    // mock-http-service
    'mock-http-service' => Server::class,

    // 文件解析
    OcrFileParserDriverInterface::class => OcrFileParserDriver::class,
    TextFileParserDriverInterface::class => TextFileParserDriver::class,
    ExcelFileParserDriverInterface::class => ExcelFileParserDriver::class,
    WordFileParserDriverInterface::class => WordFileParserDriver::class,
    PdfFileParserDriverInterface::class => PdfFileParserDriver::class,

    // 知识库
    KnowledgeBaseStrategyInterface::class => BaseKnowledgeBaseStrategy::class,
    ExternalFileDocumentFileStrategyInterface::class => ExternalFileDocumentFileStrategyDriver::class,
    ThirdPlatformDocumentFileStrategyInterface::class => ThirdPlatformDocumentFileStrategyDriver::class,
    ExternalDocumentFileInterface::class => ExternalDocumentFile::class,
    ThirdPlatformDocumentFileInterface::class => ThirdPlatformDocumentFile::class,

    // admin
    AdminGlobalSettingsRepositoryInterface::class => AdminGlobalSettingsRepository::class,

    // 权限
    PermissionInterface::class => Permission::class,
    MagicPermissionInterface::class => MagicPermission::class,

    // broadcast
    SubscriberInterface::class => AmqpSubscriber::class,
    PublisherInterface::class => AmqpPublisher::class,

    // high-availability
    EndpointProviderInterface::class => ModelGatewayEndpointProvider::class,

    // long-term-memory
    LongTermMemoryRepositoryInterface::class => MySQLLongTermMemoryRepository::class,

    WatermarkConfigInterface::class => DefaultWatermarkConfig::class,
    PointComponentInterface::class => PointComponent::class,

    // package filter
    PackageFilterInterface::class => DefaultPackageFilter::class,

    FontProviderInterface::class => DefaultFontProvider::class,
    ImageEnhancementProcessorInterface::class => NullImageEnhancementProcessor::class,

    // mode
    ModeRepositoryInterface::class => ModeRepository::class,
    ModeGroupRepositoryInterface::class => ModeGroupRepository::class,
    ModeGroupRelationRepositoryInterface::class => ModeGroupRelationRepository::class,
];

// 如果存在重复,优先取dependencies_priority的配置,不存在重复，就合并
$configFromProviders = [];
if (class_exists(ProviderConfig::class)) {
    $configFromProviders = ProviderConfig::load();
}

$dependenciesPriority = $configFromProviders['dependencies_priority'] ?? [];
foreach ($dependenciesPriority as $key => $value) {
    $dependencies[$key] = $value;
}

return $dependencies;
