import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getCommonRuntimeFieldVisibility } from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config";
import { providerModelType } from "@magic-admin-v2/features/platform-model-list/types";

const editorSource = readFileSync(
  "src/features/platform-model-list/components/model-editor-dialog.tsx",
  "utf8",
) + readFileSync(
  "src/features/platform-model-list/components/model-editor-runtime-fields.tsx",
  "utf8",
) + readFileSync(
  "src/features/platform-model-list/utils/model-editor.ts",
  "utf8",
);
const providerBindingSource = readFileSync(
  "src/features/platform-model-list/components/provider-binding-card.tsx",
  "utf8",
);

describe("platform model embedding runtime configuration", () => {
  it("matches the legacy Embedding field visibility", () => {
    assert.deepEqual(getCommonRuntimeFieldVisibility(providerModelType.embedding, true), {
      chatApi: false,
      capabilities: false,
      maxOutputTokens: true,
      maxTokens: false,
      temperature: true,
      vectorSize: true,
    });
  });

  it("keeps the normal LLM runtime fields unchanged", () => {
    assert.deepEqual(getCommonRuntimeFieldVisibility(providerModelType.largeLanguageModel, true), {
      chatApi: true,
      capabilities: true,
      maxOutputTokens: true,
      maxTokens: true,
      temperature: true,
      vectorSize: false,
    });
  });

  it("does not expose shared runtime fields for image or video models", () => {
    [providerModelType.textToImage, providerModelType.textToVideo].forEach((modelType) => {
      assert.deepEqual(getCommonRuntimeFieldVisibility(modelType, true), {
        chatApi: false,
        capabilities: false,
        maxOutputTokens: false,
        maxTokens: false,
        temperature: false,
        vectorSize: false,
      });
    });
  });

  it("only exposes official runtime options to the official organization", () => {
    assert.deepEqual(getCommonRuntimeFieldVisibility(providerModelType.largeLanguageModel, false), {
      chatApi: true,
      capabilities: false,
      maxOutputTokens: false,
      maxTokens: true,
      temperature: false,
      vectorSize: false,
    });
    assert.deepEqual(getCommonRuntimeFieldVisibility(providerModelType.embedding, false), {
      chatApi: false,
      capabilities: false,
      maxOutputTokens: false,
      maxTokens: false,
      temperature: false,
      vectorSize: true,
    });
  });

  it("drives editor rendering and error focus from model_type instead of category", () => {
    assert.equal(editorSource.includes("modelType={modelType}"), true);
    assert.equal(
      editorSource.includes("getCommonRuntimeFieldVisibility(modelType, isOfficialOrganization)"),
      true,
    );
    assert.equal(editorSource.includes("isEmbeddingModelType(modelType)"), true);
    assert.equal(editorSource.includes('name="chat_api"'), true);
    assert.equal(editorSource.includes("hasCommonRuntimeFields(modelType)"), true);
    assert.equal(
      editorSource.includes(
        "const isEmbedding = category === providerModelCategory.embedding",
      ),
      false,
    );
  });

  it("exposes extra headers and bodies for LLM and Embedding model types", () => {
    assert.equal(
      providerBindingSource.includes(
        "category === providerModelCategory.llm || isEmbeddingModelType(modelType)",
      ),
      true,
    );
    assert.equal(providerBindingSource.includes("supportsExtraRequest && !isOfficialSynced"), true);
    assert.equal(
      editorSource.includes(
        "values.category === providerModelCategory.llm || isEmbeddingModelType(values.model_type)",
      ),
      true,
    );
    assert.equal(editorSource.includes("supportsExtraRequest && (binding.extra_header.trim()"), true);
  });

  it("keeps the backend Embedding category persisted as LLM", () => {
    assert.equal(
      editorSource.includes(
        "const persistedCategory = isEmbedding ? providerModelCategory.llm : values.category",
      ),
      true,
    );
    assert.equal(editorSource.includes("category: persistedCategory"), true);
    assert.equal(editorSource.includes("model_type: values.model_type"), true);
  });
});
