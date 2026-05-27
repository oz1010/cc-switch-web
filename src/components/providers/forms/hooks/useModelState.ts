import { useState, useCallback, useEffect, useRef } from "react";

interface UseModelStateProps {
  settingsConfig: string;
  onConfigChange: (config: string) => void;
}

const ONE_M_MARKER_PATTERN = /\s*\[1m\]\s*$/i;

export const hasClaudeOneMMarker = (value: string): boolean =>
  ONE_M_MARKER_PATTERN.test(value);

export const stripClaudeOneMMarker = (value: string): string =>
  value.replace(ONE_M_MARKER_PATTERN, "").trim();

export const setClaudeOneMMarker = (
  value: string,
  enabled: boolean,
): string => {
  const stripped = stripClaudeOneMMarker(value);
  return enabled && stripped ? `${stripped}[1M]` : stripped;
};

/**
 * Parse model values from settings config JSON
 */
function parseModelsFromConfig(settingsConfig: string) {
  try {
    const cfg = settingsConfig ? JSON.parse(settingsConfig) : {};
    const env = cfg?.env || {};
    const model =
      typeof env.ANTHROPIC_MODEL === "string" ? env.ANTHROPIC_MODEL : "";
    const small =
      typeof env.ANTHROPIC_SMALL_FAST_MODEL === "string"
        ? env.ANTHROPIC_SMALL_FAST_MODEL
        : "";
    const haiku =
      typeof env.ANTHROPIC_DEFAULT_HAIKU_MODEL === "string"
        ? env.ANTHROPIC_DEFAULT_HAIKU_MODEL
        : small || model;
    const sonnet =
      typeof env.ANTHROPIC_DEFAULT_SONNET_MODEL === "string"
        ? env.ANTHROPIC_DEFAULT_SONNET_MODEL
        : model || small;
    const opus =
      typeof env.ANTHROPIC_DEFAULT_OPUS_MODEL === "string"
        ? env.ANTHROPIC_DEFAULT_OPUS_MODEL
        : model || small;
    const haikuName =
      typeof env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME === "string"
        ? env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME
        : stripClaudeOneMMarker(haiku);
    const sonnetName =
      typeof env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME === "string"
        ? env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME
        : stripClaudeOneMMarker(sonnet);
    const opusName =
      typeof env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME === "string"
        ? env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME
        : stripClaudeOneMMarker(opus);

    return { model, haiku, haikuName, sonnet, sonnetName, opus, opusName };
  } catch {
    return {
      model: "",
      haiku: "",
      haikuName: "",
      sonnet: "",
      sonnetName: "",
      opus: "",
      opusName: "",
    };
  }
}

/**
 * 管理模型选择状态
 * 支持 ANTHROPIC_MODEL 和各类型默认模型
 */
export function useModelState({
  settingsConfig,
  onConfigChange,
}: UseModelStateProps) {
  // Initialize state by parsing config directly (fixes edit mode backfill)
  const [claudeModel, setClaudeModel] = useState(
    () => parseModelsFromConfig(settingsConfig).model,
  );
  const [defaultHaikuModel, setDefaultHaikuModel] = useState(
    () => parseModelsFromConfig(settingsConfig).haiku,
  );
  const [defaultHaikuModelName, setDefaultHaikuModelName] = useState(
    () => parseModelsFromConfig(settingsConfig).haikuName,
  );
  const [defaultSonnetModel, setDefaultSonnetModel] = useState(
    () => parseModelsFromConfig(settingsConfig).sonnet,
  );
  const [defaultSonnetModelName, setDefaultSonnetModelName] = useState(
    () => parseModelsFromConfig(settingsConfig).sonnetName,
  );
  const [defaultOpusModel, setDefaultOpusModel] = useState(
    () => parseModelsFromConfig(settingsConfig).opus,
  );
  const [defaultOpusModelName, setDefaultOpusModelName] = useState(
    () => parseModelsFromConfig(settingsConfig).opusName,
  );

  const isUserEditingRef = useRef(false);
  const lastConfigRef = useRef(settingsConfig);
  const latestConfigRef = useRef(settingsConfig);

  latestConfigRef.current = settingsConfig;

  // 初始化读取：读新键；若缺失，按兼容优先级回退
  // Haiku: DEFAULT_HAIKU || SMALL_FAST || MODEL
  // Sonnet: DEFAULT_SONNET || MODEL || SMALL_FAST
  // Opus: DEFAULT_OPUS || MODEL || SMALL_FAST
  // 仅在 settingsConfig 变化时同步一次（表单加载/切换预设时）
  useEffect(() => {
    if (lastConfigRef.current === settingsConfig) {
      return;
    }

    if (isUserEditingRef.current) {
      isUserEditingRef.current = false;
      lastConfigRef.current = settingsConfig;
      return;
    }

    lastConfigRef.current = settingsConfig;

    try {
      const cfg = settingsConfig ? JSON.parse(settingsConfig) : {};
      const env = cfg?.env || {};
      const model =
        typeof env.ANTHROPIC_MODEL === "string" ? env.ANTHROPIC_MODEL : "";
      const small =
        typeof env.ANTHROPIC_SMALL_FAST_MODEL === "string"
          ? env.ANTHROPIC_SMALL_FAST_MODEL
          : "";
      const haiku =
        typeof env.ANTHROPIC_DEFAULT_HAIKU_MODEL === "string"
          ? env.ANTHROPIC_DEFAULT_HAIKU_MODEL
          : small || model;
      const sonnet =
        typeof env.ANTHROPIC_DEFAULT_SONNET_MODEL === "string"
          ? env.ANTHROPIC_DEFAULT_SONNET_MODEL
          : model || small;
      const opus =
        typeof env.ANTHROPIC_DEFAULT_OPUS_MODEL === "string"
          ? env.ANTHROPIC_DEFAULT_OPUS_MODEL
          : model || small;
      const haikuName =
        typeof env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME === "string"
          ? env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME
          : stripClaudeOneMMarker(haiku);
      const sonnetName =
        typeof env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME === "string"
          ? env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME
          : stripClaudeOneMMarker(sonnet);
      const opusName =
        typeof env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME === "string"
          ? env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME
          : stripClaudeOneMMarker(opus);

      setClaudeModel(model || "");
      setDefaultHaikuModel(haiku || "");
      setDefaultHaikuModelName(haikuName || "");
      setDefaultSonnetModel(sonnet || "");
      setDefaultSonnetModelName(sonnetName || "");
      setDefaultOpusModel(opus || "");
      setDefaultOpusModelName(opusName || "");
    } catch {
      // ignore
    }
  }, [settingsConfig]);

  const handleModelChange = useCallback(
    (
      field:
        | "ANTHROPIC_MODEL"
        | "ANTHROPIC_DEFAULT_HAIKU_MODEL"
        | "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME"
        | "ANTHROPIC_DEFAULT_SONNET_MODEL"
        | "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME"
        | "ANTHROPIC_DEFAULT_OPUS_MODEL"
        | "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
      value: string,
    ) => {
      isUserEditingRef.current = true;

      if (field === "ANTHROPIC_MODEL") setClaudeModel(value);
      if (field === "ANTHROPIC_DEFAULT_HAIKU_MODEL")
        setDefaultHaikuModel(value);
      if (field === "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME")
        setDefaultHaikuModelName(value);
      if (field === "ANTHROPIC_DEFAULT_SONNET_MODEL")
        setDefaultSonnetModel(value);
      if (field === "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME")
        setDefaultSonnetModelName(value);
      if (field === "ANTHROPIC_DEFAULT_OPUS_MODEL") setDefaultOpusModel(value);
      if (field === "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME")
        setDefaultOpusModelName(value);

      try {
        const currentConfig = latestConfigRef.current
          ? JSON.parse(latestConfigRef.current)
          : { env: {} };
        if (!currentConfig.env) currentConfig.env = {};
        const env = currentConfig.env as Record<string, unknown>;

        // 新键仅写入；旧键不再写入
        const trimmed = value.trim();
        if (trimmed) {
          env[field] = trimmed;
        } else {
          delete env[field];
        }
        // 删除旧键
        delete env["ANTHROPIC_SMALL_FAST_MODEL"];

        const updatedConfig = JSON.stringify(currentConfig, null, 2);
        latestConfigRef.current = updatedConfig;
        onConfigChange(updatedConfig);
      } catch (err) {
        console.error("Failed to update model config:", err);
      }
    },
    [onConfigChange],
  );

  return {
    claudeModel,
    setClaudeModel,
    defaultHaikuModel,
    setDefaultHaikuModel,
    defaultHaikuModelName,
    setDefaultHaikuModelName,
    defaultSonnetModel,
    setDefaultSonnetModel,
    defaultSonnetModelName,
    setDefaultSonnetModelName,
    defaultOpusModel,
    setDefaultOpusModel,
    defaultOpusModelName,
    setDefaultOpusModelName,
    handleModelChange,
  };
}
