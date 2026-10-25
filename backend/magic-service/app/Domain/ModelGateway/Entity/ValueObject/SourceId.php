<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

final class SourceId
{
    public const string RENAME_TOPIC = 'rename_topic';

    public const string SUMMARY_CONTENT = 'summary_content';

    public const string CHAT_COMPLETIONS = 'chat_completions';

    public const string CONVERSATION_CHAT_COMPLETION = 'conversation_chat_completion';

    public const string FRAGMENT_SAVED = 'fragment_saved';

    public const string KNOWLEDGE_EMBEDDING_TEST = 'knowledge_embedding_test';

    public const string KNOWLEDGE_EMBEDDING_MODEL_DIMENSION_PROBE = 'knowledge_embedding_model_dimension_probe';

    public const string SUPER_MAGIC = 'super_magic';

    public const string SUPER_MAGIC_AGENT_OPTIMIZER = 'super_magic_agent_optimizer';

    public const string SUPER_MAGIC_TEST_SG = 'super-magic-test-sg';

    public const string SEMANTIC_SEARCH = 'semantic_search';

    public const string API_PLATFORM = 'api_platform';

    public const string IMAGE_GENERATE = 'image_generate';

    public const string DESIGN_IMAGE_GENERATION = 'design_image_generation';

    public const string DESIGN_IMAGE_FILE_NAME_GENERATION = 'design_image_file_name_generation';

    public const string DESIGN_VIDEO_GENERATION = 'design_video_generation';

    public const string DESIGN_VIDEO_FILE_NAME_GENERATION = 'design_video_file_name_generation';

    public const string ASSET_COMPLIANCE_PRECHECK = 'asset_compliance_precheck';

    public const string DESIGN_IMAGE_MARK_IDENTIFY = 'design_image_mark_identify';

    public const string SK_FLOW = 'sk_flow';

    public const string IM_CHAT = 'im_chat';

    public const string MCP_TOOL = 'mcp_tool';

    public const string ROUTINE = 'routine';

    public const string TEST_RUN = 'test_run';

    public const string SINGLE_DEBUG = 'single_debug';

    public const string OAUTH2_FLOW = 'oauth2_flow';

    public const string SUPER_MAGIC_TOOL_CALL = 'super_magic_tool_call';

    public const string SUPER_MAGIC_TOOL = 'super_magic_tool';

    public const string DESIGN_IMAGE_PROMPT_COMPLETION = 'design_image_prompt_completion';

    public const string DESIGN_TEXT_CONTENT_COMPLETION = 'design_text_content_completion';

    public const string CONNECTIVITY_TEST = 'connectivity_test';

    /** 定时任务连通性测试的调用来源。 */
    public const string CRONTAB_CONNECTIVITY_TEST = 'crontab_connectivity_test';

    public const string AI_SEARCH = 'ai_search';

    public const string FOLLOW_UP_SUGGESTIONS = 'follow_up_suggestions';

    public const string AI_ABILITY_CONNECTIVITY_TEST = 'ai_ability_connectivity_test';

    public const string SLIDES_TEMPLATE_USE = 'slides_template_use';

    /** Internal system-account embedding calls used to build the slides index. */
    public const string SLIDES_TEMPLATE_VECTOR_SYNC = 'slides_template_vector_sync';

    /** Internal system-account embedding calls used to build the SkillMarket index. */
    public const string SKILL_MARKET_VECTOR_SYNC = 'skill_market_vector_sync';

    /** Internal system-account embedding calls used to build the Agent Market index. */
    public const string AGENT_MARKET_VECTOR_SYNC = 'agent_market_vector_sync';

    public const array NON_BILLING_SOURCE_IDS = [
        self::RENAME_TOPIC,
        self::SUMMARY_CONTENT,
        self::CHAT_COMPLETIONS,
        self::CONVERSATION_CHAT_COMPLETION,
        self::FRAGMENT_SAVED,
        self::KNOWLEDGE_EMBEDDING_TEST,
        self::KNOWLEDGE_EMBEDDING_MODEL_DIMENSION_PROBE,
        self::SUPER_MAGIC_AGENT_OPTIMIZER,
        self::SUPER_MAGIC_TEST_SG,
        self::SEMANTIC_SEARCH,
        self::API_PLATFORM,
        self::FOLLOW_UP_SUGGESTIONS,
        self::AI_ABILITY_CONNECTIVITY_TEST,
        self::ASSET_COMPLIANCE_PRECHECK,
        self::SLIDES_TEMPLATE_VECTOR_SYNC,
        self::SKILL_MARKET_VECTOR_SYNC,
        self::AGENT_MARKET_VECTOR_SYNC,
    ];

    public static function isNonBilling(string $sourceId): bool
    {
        return in_array($sourceId, self::NON_BILLING_SOURCE_IDS, true);
    }
}
