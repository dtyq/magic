# Parameters and Error Handling

## Parameter Guidance
- Step 1: inspect the runtime video-model capability config already injected into the conversation
- Step 2: fill priority inputs first
  - the generation goal itself
  - canvas placement: `project_path`, `name`, `width`, `height`
  - user-requested size/resolution intent
  - user-requested duration intent
  - reference inputs such as reference images or start/end frames
- Step 3: leave non-priority parameters empty by default
- `width` / `height` are canvas layout dimensions and may differ from real generation resolution
- Let the default handling take care of the rest when the user did not explicitly ask for more controls

## Error Handling
- `queued` / `running` / `processing` are not failures
- When it truly fails, explain the error directly
- Do not auto-downgrade to image generation
- Do not silently create a new video job "to try again" unless the user explicitly asks for regeneration

## Reading Results
- `pending_operations`: source of truth for future follow-up after the creation flow timed out
- `created_elements`: elements created in this run
- `elements`: updated element details
