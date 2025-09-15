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

// Sign handles unified signing requests
func (h *SignHandler) Sign(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req model.SignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Data == "" {
		http.Error(w, "data is required", http.StatusBadRequest)
		return
	}

	// Sign the data directly
	signature, err := h.gpgService.SignData(req.Data)

	if err != nil {
		http.Error(w, "Failed to sign data", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := model.SignResponse{
		Signature: signature,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
