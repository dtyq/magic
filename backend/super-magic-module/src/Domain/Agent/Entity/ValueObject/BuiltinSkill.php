<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use function Hyperf\Translation\trans;

enum BuiltinSkill: string
{
    case AnalyzingDataDashboard = 'analyzing-data-dashboard';
    case AnalyzingDataHtmlReport = 'analyzing-data-html-report';
    case ConnectingImBot = 'connecting-im-bot';
    case CreatingSlides = 'creating-slides';
    case CrewCreator = 'crew-creator';
    case DataQa = 'data-qa';
    case DeepResearch = 'deep-research';
    case DesigningCanvasImages = 'designing-canvas-images';
    case EnvManager = 'env-manager';
    case FindSkill = 'find-skill';
    case SkillCreator = 'skill-creator';
    case StandardizingStQuotation = 'standardizing-st-quotation';
    case UsingCron = 'using-cron';
    case UsingLlm = 'using-llm';
    case UsingMcp = 'using-mcp';

    public function getSkillName(): string
    {
        return trans("builtin_skills.names.{$this->value}");
    }

    public function getSkillDescription(): string
    {
        return trans("builtin_skills.descriptions.{$this->value}");
    }

    public function getSkillIcon(): string
    {
        return '';
    }

    /**
     * @return array<BuiltinSkill>
     */
    public static function getAllBuiltinSkills(): array
    {
        return self::cases();
    }
}
