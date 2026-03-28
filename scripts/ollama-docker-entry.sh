#!/bin/sh
# Старт Ollama и однократная подгрузка модели из $OLLAMA_MODEL (синхронизируйте с AI_MODEL в compose).
# Повторный pull при уже скачанной модели занимает секунды.

MODEL="${OLLAMA_MODEL:-tinyllama}"

ollama serve &
SRV=$!

n=0
while [ "$n" -lt 120 ]; do
  if ollama list >/dev/null 2>&1; then
    break
  fi
  sleep 1
  n=$((n + 1))
done

echo "ollama: pulling model $MODEL (first run may take several minutes)..."
ollama pull "$MODEL" || echo "ollama: pull failed — run: docker compose exec ollama ollama pull $MODEL" >&2

wait "$SRV"
