import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import EndpointSpeedTest from "./EndpointSpeedTest";
import {
  ApiKeySection,
  EndpointField,
  ModelDropdown,
  ModelInputWithFetch,
} from "./shared";
import {
  fetchModelsForConfig,
  showFetchModelsError,
  type FetchedModel,
} from "@/lib/api/model-fetch";
import type {
  CodexApiFormat,
  CodexCatalogModel,
  CodexChatReasoning,
  ProviderCategory,
} from "@/types";

interface EndpointCandidate {
  url: string;
}

interface CodexFormFieldsProps {
  providerId?: string;
  // API Key
  codexApiKey: string;
  onApiKeyChange: (key: string) => void;
  category?: ProviderCategory;
  shouldShowApiKeyLink: boolean;
  websiteUrl: string;
  isPartner?: boolean;
  partnerPromotionKey?: string;

  // Base URL
  shouldShowSpeedTest: boolean;
  codexBaseUrl: string;
  onBaseUrlChange: (url: string) => void;
  isFullUrl: boolean;
  onFullUrlChange: (value: boolean) => void;
  isEndpointModalOpen: boolean;
  onEndpointModalToggle: (open: boolean) => void;
  onCustomEndpointsChange?: (endpoints: string[]) => void;
  autoSelect: boolean;
  onAutoSelectChange: (checked: boolean) => void;

  // Model Name
  shouldShowModelField?: boolean;
  modelName?: string;
  onModelNameChange?: (model: string) => void;

  // API Format
  apiFormat?: CodexApiFormat;
  onApiFormatChange?: (format: CodexApiFormat) => void;
  codexChatReasoning?: CodexChatReasoning;
  onCodexChatReasoningChange?: (value: CodexChatReasoning) => void;

  // Model Catalog
  catalogModels?: CodexCatalogModel[];
  onCatalogModelsChange?: (models: CodexCatalogModel[]) => void;

  // Speed Test Endpoints
  speedTestEndpoints: EndpointCandidate[];
}

type CodexCatalogRow = CodexCatalogModel & { rowId: string };

function createCatalogRow(seed?: Partial<CodexCatalogModel>): CodexCatalogRow {
  return {
    rowId: crypto.randomUUID(),
    model: seed?.model ?? "",
    displayName: seed?.displayName ?? "",
    contextWindow: seed?.contextWindow ?? "",
  };
}

function catalogRowsMatchModels(
  rows: Array<Pick<CodexCatalogRow, "model" | "displayName" | "contextWindow">>,
  models: CodexCatalogModel[],
): boolean {
  if (rows.length !== models.length) return false;
  return rows.every((row, i) => {
    const incoming = models[i];
    return (
      row.model === (incoming.model ?? "") &&
      (row.displayName ?? "") === (incoming.displayName ?? "") &&
      String(row.contextWindow ?? "") === String(incoming.contextWindow ?? "")
    );
  });
}

export function CodexFormFields({
  providerId,
  codexApiKey,
  onApiKeyChange,
  category,
  shouldShowApiKeyLink,
  websiteUrl,
  isPartner,
  partnerPromotionKey,
  shouldShowSpeedTest,
  codexBaseUrl,
  onBaseUrlChange,
  isFullUrl,
  onFullUrlChange,
  isEndpointModalOpen,
  onEndpointModalToggle,
  onCustomEndpointsChange,
  autoSelect,
  onAutoSelectChange,
  shouldShowModelField = true,
  modelName = "",
  onModelNameChange,
  apiFormat = "openai_responses",
  onApiFormatChange,
  codexChatReasoning = {},
  onCodexChatReasoningChange,
  catalogModels = [],
  onCatalogModelsChange,
  speedTestEndpoints,
}: CodexFormFieldsProps) {
  const { t } = useTranslation();

  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const needsLocalRouting = apiFormat === "openai_chat";
  const canEditCatalog = Boolean(onCatalogModelsChange);
  const canEditReasoning = Boolean(onCodexChatReasoningChange);
  const supportsThinking =
    codexChatReasoning.supportsThinking === true ||
    codexChatReasoning.supportsEffort === true;
  const supportsEffort = codexChatReasoning.supportsEffort === true;
  const [catalogRows, setCatalogRows] = useState<CodexCatalogRow[]>(() =>
    catalogModels.map((model) => createCatalogRow(model)),
  );
  const lastSentModelsRef = useRef<CodexCatalogModel[]>(catalogModels);

  useEffect(() => {
    setCatalogRows((current) => {
      if (catalogRowsMatchModels(current, catalogModels)) return current;
      return catalogModels.map((model) => createCatalogRow(model));
    });
    lastSentModelsRef.current = catalogModels;
  }, [catalogModels]);

  useEffect(() => {
    if (!onCatalogModelsChange) return;
    const next: CodexCatalogModel[] = catalogRows.map(
      ({ rowId: _rowId, ...rest }) => rest,
    );
    if (catalogRowsMatchModels(catalogRows, lastSentModelsRef.current)) return;
    lastSentModelsRef.current = next;
    onCatalogModelsChange(next);
  }, [catalogRows, onCatalogModelsChange]);

  const handleLocalRoutingChange = useCallback(
    (checked: boolean) => {
      onApiFormatChange?.(checked ? "openai_chat" : "openai_responses");
    },
    [onApiFormatChange],
  );

  const handleReasoningThinkingChange = useCallback(
    (checked: boolean) => {
      onCodexChatReasoningChange?.({
        ...codexChatReasoning,
        supportsThinking: checked,
        supportsEffort: checked ? codexChatReasoning.supportsEffort : false,
      });
    },
    [codexChatReasoning, onCodexChatReasoningChange],
  );

  const handleReasoningEffortChange = useCallback(
    (checked: boolean) => {
      onCodexChatReasoningChange?.({
        ...codexChatReasoning,
        supportsThinking: checked ? true : codexChatReasoning.supportsThinking,
        supportsEffort: checked,
        effortParam: checked
          ? (codexChatReasoning.effortParam ?? "reasoning_effort")
          : "none",
      });
    },
    [codexChatReasoning, onCodexChatReasoningChange],
  );

  const handleFetchModels = useCallback(() => {
    if (!codexBaseUrl || !codexApiKey) {
      showFetchModelsError(null, t, {
        hasApiKey: !!codexApiKey,
        hasBaseUrl: !!codexBaseUrl,
      });
      return;
    }
    setIsFetchingModels(true);
    fetchModelsForConfig(codexBaseUrl, codexApiKey, isFullUrl)
      .then((models) => {
        setFetchedModels(models);
        if (models.length === 0) {
          toast.info(t("providerForm.fetchModelsEmpty"));
        } else {
          toast.success(
            t("providerForm.fetchModelsSuccess", { count: models.length }),
          );
        }
      })
      .catch((err) => {
        console.warn("[ModelFetch] Failed:", err);
        showFetchModelsError(err, t);
      })
      .finally(() => setIsFetchingModels(false));
  }, [codexBaseUrl, codexApiKey, isFullUrl, t]);

  const handleAddCatalogRow = useCallback(() => {
    if (!onCatalogModelsChange) return;
    setCatalogRows((current) => [...current, createCatalogRow()]);
  }, [onCatalogModelsChange]);

  const handleUpdateCatalogRow = useCallback(
    (index: number, patch: Partial<CodexCatalogModel>) => {
      setCatalogRows((current) =>
        current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const handleRemoveCatalogRow = useCallback((index: number) => {
    setCatalogRows((current) => current.filter((_, i) => i !== index));
  }, []);

  return (
    <>
      {/* Codex API Key 输入框 */}
      <ApiKeySection
        id="codexApiKey"
        label="API Key"
        value={codexApiKey}
        onChange={onApiKeyChange}
        category={category}
        shouldShowLink={shouldShowApiKeyLink}
        websiteUrl={websiteUrl}
        isPartner={isPartner}
        partnerPromotionKey={partnerPromotionKey}
        placeholder={{
          official: t("providerForm.codexOfficialNoApiKey", {
            defaultValue: "官方供应商无需 API Key",
          }),
          thirdParty: t("providerForm.codexApiKeyAutoFill", {
            defaultValue: "输入 API Key，将自动填充到配置",
          }),
        }}
      />

      {/* Codex Base URL 输入框 */}
      {shouldShowSpeedTest && (
        <EndpointField
          id="codexBaseUrl"
          label={t("codexConfig.apiUrlLabel")}
          value={codexBaseUrl}
          onChange={onBaseUrlChange}
          placeholder={t("providerForm.codexApiEndpointPlaceholder")}
          hint={t("providerForm.codexApiHint")}
          showFullUrlToggle
          isFullUrl={isFullUrl}
          onFullUrlChange={onFullUrlChange}
          onManageClick={() => onEndpointModalToggle(true)}
        />
      )}

      {shouldShowSpeedTest && onApiFormatChange && (
        <div className="space-y-3 rounded-lg border border-border-default bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <FormLabel>
                {t("codexConfig.localRoutingToggle", {
                  defaultValue: "需要本地路由映射",
                })}
              </FormLabel>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {needsLocalRouting
                  ? t("codexConfig.localRoutingOnHint", {
                      defaultValue:
                        "非 OpenAI Responses 协议或非 GPT 模型需要通过本地路由转换。",
                    })
                  : t("codexConfig.localRoutingOffHint", {
                      defaultValue:
                        "供应商不是原生 OpenAI Responses API 时请打开此开关。",
                    })}
              </p>
            </div>
            <Switch
              checked={needsLocalRouting}
              onCheckedChange={handleLocalRoutingChange}
              aria-label={t("codexConfig.localRoutingToggle", {
                defaultValue: "需要本地路由映射",
              })}
            />
          </div>
        </div>
      )}

      {needsLocalRouting && canEditReasoning && (
        <Collapsible
          open={reasoningExpanded}
          onOpenChange={setReasoningExpanded}
          className="rounded-lg border border-border-default p-4"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant={null}
              size="sm"
              className="h-8 w-full justify-start gap-1.5 px-0 text-sm font-medium text-foreground hover:opacity-70"
            >
              {reasoningExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {t("codexConfig.reasoningSectionToggle", {
                defaultValue: "思考能力（高级·通常自动识别）",
              })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <FormLabel>
                  {t("codexConfig.reasoningModeToggle", {
                    defaultValue: "支持思考模式",
                  })}
                </FormLabel>
              </div>
              <Switch
                checked={supportsThinking}
                onCheckedChange={handleReasoningThinkingChange}
                aria-label={t("codexConfig.reasoningModeToggle", {
                  defaultValue: "支持思考模式",
                })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border-default pt-3">
              <div className="space-y-1">
                <FormLabel>
                  {t("codexConfig.reasoningEffortToggle", {
                    defaultValue: "支持思考等级",
                  })}
                </FormLabel>
              </div>
              <Switch
                checked={supportsEffort}
                onCheckedChange={handleReasoningEffortChange}
                aria-label={t("codexConfig.reasoningEffortToggle", {
                  defaultValue: "支持思考等级",
                })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Codex Model Name 输入框 */}
      {shouldShowModelField && onModelNameChange && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="codexModelName"
              className="block text-sm font-medium text-foreground"
            >
              {t("codexConfig.modelName", { defaultValue: "模型名称" })}
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchModels}
              disabled={isFetchingModels}
              className="h-7 gap-1"
            >
              {isFetchingModels ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("providerForm.fetchModels")}
            </Button>
          </div>
          <ModelInputWithFetch
            id="codexModelName"
            value={modelName}
            onChange={(v) => onModelNameChange!(v)}
            placeholder={t("codexConfig.modelNamePlaceholder", {
              defaultValue: "例如: gpt-5.4",
            })}
            fetchedModels={fetchedModels}
            isLoading={isFetchingModels}
          />
          <p className="text-xs text-muted-foreground">
            {modelName.trim()
              ? t("codexConfig.modelNameHint", {
                  defaultValue: "指定使用的模型，将自动更新到 config.toml 中",
                })
              : t("providerForm.modelHint", {
                  defaultValue: "💡 留空将使用供应商的默认模型",
                })}
          </p>
        </div>
      )}

      {needsLocalRouting && canEditCatalog && (
        <div className="space-y-4 rounded-lg border border-border-default p-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <FormLabel>
                {t("codexConfig.modelMappingTitle", {
                  defaultValue: "模型映射",
                })}
              </FormLabel>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="h-7 gap-1"
                >
                  {isFetchingModels ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {t("providerForm.fetchModels")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCatalogRow}
                  className="h-7 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("codexConfig.addCatalogModel", {
                    defaultValue: "添加模型",
                  })}
                </Button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("codexConfig.modelMappingHint", {
                defaultValue:
                  "本地路由会把 Codex 请求映射到这里配置的实际模型。",
              })}
            </p>
          </div>

          {catalogRows.length > 0 && (
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_1fr_140px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
                <span>
                  {t("codexConfig.catalogColumnDisplay", {
                    defaultValue: "菜单显示名",
                  })}
                </span>
                <span>
                  {t("codexConfig.catalogColumnModel", {
                    defaultValue: "实际请求模型",
                  })}
                </span>
                <span>
                  {t("codexConfig.catalogColumnContext", {
                    defaultValue: "上下文窗口",
                  })}
                </span>
                <span />
              </div>

              {catalogRows.map((row, index) => (
                <div
                  key={row.rowId}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_140px_36px]"
                >
                  <Input
                    value={row.displayName ?? ""}
                    onChange={(event) =>
                      handleUpdateCatalogRow(index, {
                        displayName: event.target.value,
                      })
                    }
                    placeholder={t(
                      "codexConfig.catalogDisplayNamePlaceholder",
                      {
                        defaultValue: "例如: DeepSeek V4 Flash",
                      },
                    )}
                    aria-label={t("codexConfig.catalogColumnDisplay", {
                      defaultValue: "菜单显示名",
                    })}
                  />
                  <div className="flex gap-1">
                    <Input
                      value={row.model}
                      onChange={(event) =>
                        handleUpdateCatalogRow(index, {
                          model: event.target.value,
                        })
                      }
                      placeholder={t("codexConfig.catalogModelPlaceholder", {
                        defaultValue: "例如: deepseek-v4-flash",
                      })}
                      aria-label={t("codexConfig.catalogColumnModel", {
                        defaultValue: "实际请求模型",
                      })}
                      className="flex-1"
                    />
                    {fetchedModels.length > 0 && (
                      <ModelDropdown
                        models={fetchedModels}
                        onSelect={(id) =>
                          handleUpdateCatalogRow(index, {
                            model: id,
                            displayName: row.displayName?.trim()
                              ? row.displayName
                              : id,
                          })
                        }
                      />
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={row.contextWindow ?? ""}
                    onChange={(event) =>
                      handleUpdateCatalogRow(index, {
                        contextWindow: event.target.value.replace(/[^\d]/g, ""),
                      })
                    }
                    placeholder={t("codexConfig.contextWindowPlaceholder", {
                      defaultValue: "例如: 128000",
                    })}
                    aria-label={t("codexConfig.catalogColumnContext", {
                      defaultValue: "上下文窗口",
                    })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveCatalogRow(index)}
                    title={t("common.delete", { defaultValue: "删除" })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 端点测速弹窗 - Codex */}
      {shouldShowSpeedTest && isEndpointModalOpen && (
        <EndpointSpeedTest
          appId="codex"
          providerId={providerId}
          value={codexBaseUrl}
          onChange={onBaseUrlChange}
          initialEndpoints={speedTestEndpoints}
          visible={isEndpointModalOpen}
          onClose={() => onEndpointModalToggle(false)}
          autoSelect={autoSelect}
          onAutoSelectChange={onAutoSelectChange}
          onCustomEndpointsChange={onCustomEndpointsChange}
        />
      )}
    </>
  );
}
