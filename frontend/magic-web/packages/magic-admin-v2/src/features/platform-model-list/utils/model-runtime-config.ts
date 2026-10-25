import {
  providerModelType,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";

/**
 * Embedding is persisted under the LLM category, so runtime behavior must be
 * derived from model_type instead of the backend-facing category value.
 */
export function isEmbeddingModelType(modelType: ProviderModelType) {
  return modelType === providerModelType.embedding;
}

/** Image and video models do not expose the shared LLM runtime parameters. */
export function hasCommonRuntimeFields(modelType: ProviderModelType) {
  return modelType === providerModelType.largeLanguageModel || isEmbeddingModelType(modelType);
}

export function getCommonRuntimeFieldVisibility(
  modelType: ProviderModelType,
  isOfficialOrganization: boolean,
) {
  const isEmbedding = isEmbeddingModelType(modelType);
  const hasRuntimeFields = hasCommonRuntimeFields(modelType);
  const canConfigureOfficialRuntime = hasRuntimeFields && isOfficialOrganization;
  const isLargeLanguageModel = modelType === providerModelType.largeLanguageModel;

  return {
    chatApi: isLargeLanguageModel,
    capabilities: canConfigureOfficialRuntime && !isEmbedding,
    maxOutputTokens: canConfigureOfficialRuntime,
    maxTokens: hasRuntimeFields && !isEmbedding,
    temperature: canConfigureOfficialRuntime,
    vectorSize: hasRuntimeFields && isEmbedding,
  };
}
