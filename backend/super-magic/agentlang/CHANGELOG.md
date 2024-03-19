# Changelog

All notable changes to the agentlang package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-07-23

### Changed
- **Internal Refactoring**: Migrated `_dynamic_model_id` from instance variable to `AgentSharedContext` for better architecture consistency
- Improved state management in `BaseAgentContext` for unified context handling
- Enhanced test coverage for dynamic model ID functionality

### Technical Details
- All public APIs remain unchanged (backward compatible)
- Better integration with the shared context pattern used throughout the framework
- Comprehensive test validation (16 test cases passing)

## [0.1.3] - Previous Release
- Previous functionality maintained
