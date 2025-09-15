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
	ed25519Service *service.Ed25519Service
	logger         *log.Logger
}

// NewSignHandler creates a new sign handler with Ed25519 service initialization
func NewSignHandler(logger *log.Logger) (*SignHandler, error) {
	// Get Ed25519 private key from environment
	ed25519PrivateKey := os.Getenv("ED25519_PRIVATE_KEY")
	if ed25519PrivateKey == "" {
		return nil, fmt.Errorf("ED25519_PRIVATE_KEY environment variable is required")
	}

	// Initialize Ed25519 service
	ed25519Service, err := service.NewEd25519Service(ed25519PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Ed25519 service: %w", err)
	}

	return &SignHandler{
		ed25519Service: ed25519Service,
		logger:         logger,
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

	// Sign the data using Ed25519
	signature, err := h.ed25519Service.SignData(req.Data)
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
