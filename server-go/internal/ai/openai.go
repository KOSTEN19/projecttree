package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client вызывает OpenAI-compatible Chat Completions (OpenAI, Ollama, OpenRouter, …).
type Client struct {
	BaseURL   string
	APIKey    string
	Model     string
	Timeout   time.Duration
	MaxTokens int
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// ollamaChatResponse — ответ POST /api/chat (stream: false).
type ollamaChatResponse struct {
	Message *chatMessage `json:"message"`
	Error   string       `json:"error,omitempty"`
}

// ollamaAPIRoot убирает суффикс /v1 из BaseURL (как в OpenAI-совместимом Ollama).
func (c *Client) ollamaAPIRoot() string {
	base := strings.TrimSuffix(strings.TrimSpace(c.BaseURL), "/")
	if strings.HasSuffix(strings.ToLower(base), "/v1") {
		return base[:len(base)-3]
	}
	return base
}

// chatOllamaNative — нативный Ollama API (нужен для образов без маршрута /v1/chat/completions).
func (c *Client) chatOllamaNative(ctx context.Context, httpClient *http.Client, systemPrompt, userPrompt string, maxTok int) (string, error) {
	root := c.ollamaAPIRoot()
	if root == "" {
		return "", fmt.Errorf("ai: empty base URL for ollama native")
	}
	url := strings.TrimSuffix(root, "/") + "/api/chat"
	payload := map[string]any{
		"model": c.Model,
		"messages": []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		"stream": false,
		"options": map[string]any{
			"num_predict": maxTok,
			"temperature": 0.35,
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return "", fmt.Errorf("ai: ollama /api/chat HTTP %d: %s", res.StatusCode, string(bytes.TrimSpace(b)))
	}
	var out ollamaChatResponse
	if err := json.Unmarshal(b, &out); err != nil {
		return "", fmt.Errorf("ai: ollama decode: %w", err)
	}
	if strings.TrimSpace(out.Error) != "" {
		return "", fmt.Errorf("ai: ollama: %s", out.Error)
	}
	if out.Message == nil || strings.TrimSpace(out.Message.Content) == "" {
		return "", fmt.Errorf("ai: ollama empty message")
	}
	return strings.TrimSpace(out.Message.Content), nil
}

// ChatComplete возвращает текст ответа ассистента.
func (c *Client) ChatComplete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if strings.TrimSpace(c.BaseURL) == "" || strings.TrimSpace(c.Model) == "" {
		return "", fmt.Errorf("ai: missing base URL or model")
	}
	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	maxTok := c.MaxTokens
	if maxTok <= 0 {
		maxTok = 384
	}

	body := chatRequest{
		Model: c.Model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens:   maxTok,
		Temperature: 0.35,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	url := strings.TrimSuffix(c.BaseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(c.APIKey) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.APIKey))
	}

	client := &http.Client{Timeout: timeout}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode == http.StatusNotFound {
		return c.chatOllamaNative(ctx, client, systemPrompt, userPrompt, maxTok)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return "", fmt.Errorf("ai: HTTP %d: %s", res.StatusCode, string(bytes.TrimSpace(b)))
	}

	var out chatResponse
	if err := json.Unmarshal(b, &out); err != nil {
		return "", fmt.Errorf("ai: decode: %w", err)
	}
	if out.Error != nil && out.Error.Message != "" {
		return "", fmt.Errorf("ai: %s", out.Error.Message)
	}
	if len(out.Choices) == 0 || strings.TrimSpace(out.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("ai: empty choices")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}
