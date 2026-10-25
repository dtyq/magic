<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Assembler;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent\AgentMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Assistant\AssistantMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\DesignMarker\DesignMarkerMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Directory\DirectoryMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Directory\UserDirectoryMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File\ProjectFileMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File\UploadFileMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File\UserFileMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Mcp\McpMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionInterface;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp\MicroAppMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Project\ProjectMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Skill\SkillMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Tool\ToolMention;

final class MentionAssembler
{
    public static function fromArray(array $mention): ?MentionInterface
    {
        if (! isset($mention['attrs']['type'])) {
            return null;
        }

        $mentionAttrType = MentionType::tryFrom($mention['attrs']['type']);

        return match ($mentionAttrType) {
            MentionType::PROJECT_FILE => new ProjectFileMention($mention),
            MentionType::PROJECT_DIRECTORY => new DirectoryMention($mention),
            MentionType::USER_FILE, MentionType::MEMORY_FILE => new UserFileMention($mention),
            MentionType::USER_DIRECTORY, MentionType::MEMORY_DIRECTORY => new UserDirectoryMention($mention),
            MentionType::PROJECT => new ProjectMention($mention),
            MentionType::UPLOAD_FILE => new UploadFileMention($mention),
            MentionType::AGENT => new AgentMention($mention),
            MentionType::ASSISTANT => new AssistantMention($mention),
            MentionType::MCP => new McpMention($mention),
            MentionType::MICRO_APP => new MicroAppMention($mention),
            MentionType::TOOL => new ToolMention($mention),
            MentionType::DESIGN_MARKER => new DesignMarkerMention($mention),
            MentionType::SKILL => new SkillMention($mention),
            default => null,
        };
    }
}
