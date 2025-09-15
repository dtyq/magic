package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"api-gateway/internal/model"
	"api-gateway/internal/service"
)

// SignHandler handles signing operations
type SignHandler struct {
	gpgService *service.GPGService
	logger     *log.Logger
}

// NewSignHandler creates a new sign handler with GPG service initialization
func NewSignHandler(logger *log.Logger) (*SignHandler, error) {
	// Get GPG private key from environment
	gpgPrivateKey := os.Getenv("GPG_PRIVATE_KEY")
	if gpgPrivateKey == "" {
		return nil, fmt.Errorf("GPG_PRIVATE_KEY environment variable is required")
	}

	// Initialize GPG service
	gpgService, err := service.NewGPGService(gpgPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize GPG service: %w", err)
	}

	return &SignHandler{
		gpgService: gpgService,
		logger:     logger,
	}, nil
}

// SignMetadata handles metadata signing requests
func (h *SignHandler) SignMetadata(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req model.MetadataSignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Metadata == nil {
		http.Error(w, "metadata is required", http.StatusBadRequest)
		return
	}

	// Get user information from withAuth middleware
	userID := r.Header.Get("magic-user-id")
	orgCode := r.Header.Get("magic-organization-code")

	if userID == "" || orgCode == "" {
		http.Error(w, "user authentication required", http.StatusBadRequest)
		return
	}

	// Add user information to metadata
	req.Metadata["user_id"] = userID
	req.Metadata["organization_code"] = orgCode

	// Convert metadata to JSON for signing
	metadataBytes, err := json.Marshal(req.Metadata)
	if err != nil {
		http.Error(w, "Failed to process metadata", http.StatusInternalServerError)
		return
	}

	// Sign metadata
	metadataSignature, err := h.gpgService.SignData(string(metadataBytes))
	if err != nil {
		http.Error(w, "Failed to sign metadata", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := model.MetadataSignResponse{
		Signature: metadataSignature,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// SignPayload handles payload signing requests
func (h *SignHandler) SignPayload(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req model.PayloadSignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Payload == "" {
		http.Error(w, "payload is required", http.StatusBadRequest)
		return
	}

	// Sign payload directly
	payloadSignature, err := h.gpgService.SignData(req.Payload)
	if err != nil {
		http.Error(w, "Failed to sign payload", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := model.PayloadSignResponse{
		Signature: payloadSignature,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
