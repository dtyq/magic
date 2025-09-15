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
	blake3Service *service.Blake3Service
	logger        *log.Logger
}

// NewSignHandler creates a new sign handler with Blake3 service initialization
func NewSignHandler(logger *log.Logger) (*SignHandler, error) {
	// Get Blake3 key from environment
	blake3Key := os.Getenv("AI_DATA_SIGNING_KEY")
	if blake3Key == "" {
		return nil, fmt.Errorf("AI_DATA_SIGNING_KEY environment variable is required")
	}

	// Initialize Blake3 service
	blake3Service, err := service.NewBlake3Service(blake3Key)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Blake3 service: %w", err)
	}

	return &SignHandler{
		blake3Service: blake3Service,
		logger:        logger,
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

	// Sign the data using Blake3
	signature, err := h.blake3Service.SignData(req.Data)
	if err != nil {
		h.logger.Printf("Failed to sign data: %v", err)
		http.Error(w, "Failed to sign data", http.StatusInternalServerError)
		return
	}

	// Return success response
	response := model.SignResponse{
		Signature: signature,
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		h.logger.Printf("Failed to encode response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}
