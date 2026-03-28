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
