"use client";

import { useStore } from "jotai";
import { ChevronRight, Copy, RotateCcw, Search, X } from "lucide-react";
import {
  type FocusEvent,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { copyTextToClipboard } from "../../adapters/browser/file-actions";
import type { GraphModel, GraphSettings } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { messagesByLocale } from "../../i18n/messages";
import { exportEdgeList } from "../../io/export-edge-list";
import {
  getSampleParameters,
  normalizeSampleParameterInput,
  normalizeSampleParameters,
  type SampleParameter,
} from "../../samples/sample-parameters";
import { matchesSampleQuery } from "../../samples/sample-search";
import {
  sampleGraphCount,
  sampleGraphGroups,
  type SampleGraphItem,
  type SampleGraphGroupKey,
} from "../../samples/registry";
import {
  createParameterizedSampleGraph,
  type SampleGraphKind,
} from "../../samples/sample-graphs";
import { graphSettingsAtom } from "../../shell/state/graph-atoms";
import { useApplyGraphModel } from "../../workflows/starter/use-apply-graph-model";
import {
  Button,
  ControlRow,
  IconButton,
  Select,
  TextInput,
  fieldLabel,
  fieldSurface,
  focusRing,
} from "@/components/ui/controls";
import { SampleGraphPreview } from "./SampleGraphPreview";
import { SAMPLE_GALLERY_GRID_CLASS } from "./sample-gallery-layout";
import { focusAfterContentSwitch } from "../primitives/focus-after-content-switch";
import { surface } from "@/components/ui/surfaces";
import { cn } from "@/lib/utils";

type SampleValues = Record<string, string>;

export function SampleGalleryPane({
  onSampleApplied,
}: {
  onSampleApplied: () => void;
}) {
  const store = useStore();
  const { messages } = useI18n();
  const applyGraphModel = useApplyGraphModel();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();
  const categoryId = useId();
  useLayoutEffect(() => focusAfterContentSwitch(searchRef.current), []);
  const [sampleQuery, setSampleQuery] = useState("");
  const [category, setCategory] = useState<SampleGraphGroupKey | "all">("all");

  const [settings, setSettings] = useState(() => store.get(graphSettingsAtom));

  const [configurations, setConfigurations] = useState<
    Partial<Record<SampleGraphKind, SampleValues>>
  >({});
  const filteredSampleGroups = useMemo(
    () =>
      sampleGraphGroups
        .filter((group) => category === "all" || group.key === category)
        .map((group) => ({
          ...group,
          samples: group.samples.filter((sample) =>
            matchesSampleQuery(sampleQuery, [
              sample.kind,
              sample.label,
              sample.subtitle,
              sample.searchTerms ?? "",
              ...Object.values(messagesByLocale).flatMap((copy) => [
                copy.samples.group[group.key].label,
                copy.samples.item[sample.kind]?.title ?? "",
                copy.samples.item[sample.kind]?.subtitle ?? "",
              ]),
            ]),
          ),
        }))
        .filter((group) => group.samples.length > 0),
    [category, sampleQuery],
  );
  const filteredSampleCount = filteredSampleGroups.reduce(
    (count, group) => count + group.samples.length,
    0,
  );
  const clearSearch = () => {
    searchRef.current?.focus();
    setSampleQuery("");
  };
  const clearFilters = () => {
    clearSearch();
    setCategory("all");
  };
  const applyModel = useCallback(
    (model: GraphModel) => {
      if (applyGraphModel(model)) onSampleApplied();
    },
    [applyGraphModel, onSampleApplied],
  );
  const updateValues = useCallback(
    (kind: SampleGraphKind, values: SampleValues) => {
      setConfigurations((current) => ({ ...current, [kind]: values }));
    },
    [],
  );

  return (
    <div className="ge-fade-in flex min-h-0 flex-1 flex-col">
      <div className="@container/sample-filters shrink-0 px-4 pt-3.5 pb-3">
        <div className="grid min-w-0 gap-2 @min-[30rem]/sample-filters:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <ControlRow
            htmlFor={searchId}
            label={messages.samples.searchAria}
            layout="stacked"
          >
            <div
              className={`flex h-8 min-w-0 items-center gap-2 rounded-lg pr-1 pl-2.5 text-[var(--muted)] focus-within:border-[var(--control-accent)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] touch:h-11 ${fieldSurface}`}
            >
              <Search className="size-3.5 shrink-0" aria-hidden="true" />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                name="sample-search"
                value={sampleQuery}
                autoComplete="off"
                onChange={(event) => setSampleQuery(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-control font-semibold text-[var(--text)] outline-none [&::-webkit-search-cancel-button]:appearance-none"
              />
              <output
                className="shrink-0 px-1 font-mono text-meta font-semibold text-[var(--muted)] tabular-nums"
                aria-live="polite"
              >
                {filteredSampleCount}/{sampleGraphCount}
              </output>
              {sampleQuery ? (
                <IconButton
                  label={messages.samples.clearSearch}
                  size="xs"
                  className="text-[var(--muted)]"
                  onClick={clearSearch}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </IconButton>
              ) : null}
            </div>
          </ControlRow>
          <ControlRow
            htmlFor={categoryId}
            label={messages.samples.category}
            layout="stacked"
          >
            <Select
              id={categoryId}
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as SampleGraphGroupKey | "all")
              }
            >
              <option value="all">{messages.samples.allCategories}</option>
              {sampleGraphGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {messages.samples.group[group.key].label}
                </option>
              ))}
            </Select>
          </ControlRow>
        </div>
      </div>
      <div
        data-sample-scroll
        tabIndex={0}
        className="ge-scrollbar ge-focus ge-focus-inset flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pb-4"
      >
        <details className="group/generation shrink-0 text-xs text-[var(--muted)]">
          <summary
            className={`flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 rounded-md pr-1.5 font-semibold transition-colors hover:text-[var(--text)] touch:min-h-11 [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <ChevronRight
              className="size-3.5 shrink-0 transition-transform group-open/generation:rotate-90 motion-reduce:transition-none"
              aria-hidden="true"
            />
            {messages.samples.generationSettings}
          </summary>
          <div className="flex flex-wrap gap-2 pt-2 pb-2">
            <label className="flex min-w-0 flex-[1_1_9rem] flex-col gap-1">
              <span className={fieldLabel}>{messages.settings.direction}</span>
              <Select
                aria-label={messages.settings.direction}
                value={String(settings.directed)}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    directed: event.target.value === "true",
                  })
                }
              >
                <option value="false">{messages.settings.undirected}</option>
                <option value="true">{messages.settings.directed}</option>
              </Select>
            </label>
            <label className="flex min-w-0 flex-[1_1_9rem] flex-col gap-1">
              <span className={fieldLabel}>{messages.settings.weight}</span>
              <Select
                aria-label={messages.settings.weight}
                value={String(settings.weighted)}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    weighted: event.target.value === "true",
                    weightKind: "number",
                  })
                }
              >
                <option value="false">{messages.settings.unweighted}</option>
                <option value="true">{messages.settings.weighted}</option>
              </Select>
            </label>
            <label className="flex min-w-0 flex-[1_1_9rem] flex-col gap-1">
              <span className={fieldLabel}>{messages.settings.indexBase}</span>
              <Select
                aria-label={messages.settings.indexBase}
                value={settings.indexBase}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    indexBase: event.target.value === "1" ? 1 : 0,
                  })
                }
              >
                <option value="0">0-indexed</option>
                <option value="1">1-indexed</option>
              </Select>
            </label>
          </div>
          <p>{messages.samples.requiredSettings}</p>
        </details>
        {filteredSampleGroups.length > 0 ? (
          filteredSampleGroups.map((group) => (
            <section key={group.key} className="flex shrink-0 flex-col gap-2.5">
              <div className="flex items-start justify-between gap-3 px-0.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="text-control font-semibold text-[var(--text)]">
                    {messages.samples.group[group.key].label}
                  </h3>
                  <div className="text-xs leading-snug text-[var(--muted)]">
                    {messages.samples.group[group.key].note}
                  </div>
                </div>
                <div className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-md bg-[var(--fill)] px-1.5 font-mono text-meta font-semibold text-[var(--muted)] tabular-nums">
                  {group.samples.length}
                </div>
              </div>
              <div className={SAMPLE_GALLERY_GRID_CLASS}>
                {group.samples.map((sample) => (
                  <SampleCard
                    key={sample.kind}
                    sample={sample}
                    settings={settings}
                    values={configurations[sample.kind]}
                    onValuesChange={updateValues}
                    onApply={applyModel}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div
            className={cn(
              surface.card,
              "flex flex-col items-center gap-3 px-5 py-8 text-center",
            )}
          >
            <div className="text-sm font-bold text-[var(--text)]">
              {messages.samples.empty}
            </div>
            <Button variant="secondary" onClick={clearFilters}>
              {messages.samples.clearFilters}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const SampleCard = memo(function SampleCard({
  sample,
  settings,
  values,
  onValuesChange,
  onApply,
}: {
  sample: SampleGraphItem;
  settings: GraphSettings;
  values?: SampleValues;
  onValuesChange: (kind: SampleGraphKind, values: SampleValues) => void;
  onApply: (model: GraphModel) => void;
}) {
  const { locale, messages } = useI18n();
  const title = messages.samples.item[sample.kind]?.title ?? sample.label;
  const subtitle =
    messages.samples.item[sample.kind]?.subtitle ??
    (locale === "ja" ? sample.subtitle : sample.label);
  const parameters = useMemo(
    () => getSampleParameters(sample.kind),
    [sample.kind],
  );
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        parameters.map((parameter) => [
          parameter.key,
          String(parameter.defaultValue),
        ]),
      ),
    [parameters],
  );
  const rawValues = values ?? defaults;
  const parametersChanged = parameters.some(
    (parameter) => rawValues[parameter.key] !== defaults[parameter.key],
  );
  const normalized = useMemo(
    () => normalizeSampleParameters(sample.kind, rawValues),
    [sample.kind, rawValues],
  );
  const deferredValues = useDeferredValue(normalized);
  const previewUpdating = deferredValues !== normalized;
  const missingValue = parameters.some(
    (parameter) => !rawValues[parameter.key]?.trim(),
  );
  const invalidValue = parameters.some((parameter) => {
    const value = normalizeSampleParameterInput(rawValues[parameter.key] ?? "");
    return value !== "" && !/^\d+$/.test(value);
  });
  const adjustments = parameters
    .filter(
      (parameter) =>
        Number(
          normalizeSampleParameterInput(rawValues[parameter.key] ?? ""),
        ) !== normalized[parameter.key],
    )
    .map(
      (parameter) =>
        `${messages.samples.parameterLabels[parameter.key]} = ${normalized[parameter.key]}`,
    );
  const previewRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  const copyVersion = useRef(0);
  const isComposingRef = useRef(false);
  const noticeId = useId();
  useEffect(() => {
    const element = previewRef.current;
    if (!element || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        root: element.closest("[data-sample-scroll]"),
        rootMargin: "320px 0px",
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  const model = useMemo(
    () =>
      visible
        ? createParameterizedSampleGraph(sample.kind, deferredValues, settings)
        : null,
    [visible, sample.kind, deferredValues, settings],
  );
  useEffect(() => {
    copyVersion.current += 1;
    setCopyStatus("idle");
  }, [rawValues, settings]);
  useEffect(() => {
    if (copyStatus !== "copied" && copyStatus !== "failed") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);
  const currentModel = () =>
    createParameterizedSampleGraph(sample.kind, normalized, settings);
  const copyHelp = model
    ? messages.samples.copyInputHelp(
        model.settings.indexBase,
        model.settings.weighted,
      )
    : undefined;
  const copyInput = async () => {
    const version = ++copyVersion.current;
    setCopyStatus("copying");
    const copied = await copyTextToClipboard(exportEdgeList(currentModel()));
    if (version === copyVersion.current) {
      setCopyStatus(copied ? "copied" : "failed");
    }
  };

  return (
    <form
      data-sample-kind={sample.kind}
      aria-label={title}
      noValidate
      className={cn(
        surface.card,
        "@container/sample-card flex flex-col overflow-hidden",
      )}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          (isComposingRef.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229)
        ) {
          event.preventDefault();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !isComposingRef.current &&
          !missingValue &&
          !invalidValue &&
          !previewUpdating
        )
          onApply(currentModel());
      }}
    >
      <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 p-2.5 @min-[300px]/sample-card:grid-cols-[106px_minmax(0,1fr)] @min-[300px]/sample-card:gap-3 @min-[300px]/sample-card:p-3">
        <span
          ref={previewRef}
          className="grid h-[76px] w-[88px] place-items-center overflow-hidden rounded-lg bg-[var(--bg)] [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:12px_12px] @min-[300px]/sample-card:h-[88px] @min-[300px]/sample-card:w-[106px]"
        >
          {model && !missingValue && !invalidValue && !previewUpdating ? (
            <SampleGraphPreview
              model={model}
              sampleKind={sample.kind}
              width={98}
              height={76}
              className="h-auto w-[80px] @min-[300px]/sample-card:w-[98px]"
            />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-control leading-tight font-bold break-words text-[var(--text)] @min-[300px]/sample-card:text-sm">
            {title}
          </span>
          <span className="text-xs leading-snug font-medium [overflow-wrap:anywhere] text-[var(--muted)]">
            {subtitle}
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-[var(--hair)] px-3 py-2.5">
        {parameters.length > 0 ? (
          <div
            className={
              sample.kind === "knight"
                ? "grid grid-cols-2 items-end gap-2"
                : "flex flex-wrap items-end gap-2"
            }
          >
            {parameters.map((parameter) => (
              <CardNumberInput
                key={parameter.key}
                parameter={parameter}
                label={messages.samples.parameterLabels[parameter.key]}
                value={rawValues[parameter.key] ?? ""}
                noticeId={noticeId}
                onChange={(value) =>
                  onValuesChange(sample.kind, {
                    ...rawValues,
                    [parameter.key]: value,
                  })
                }
              />
            ))}
          </div>
        ) : null}
        <div
          id={noticeId}
          className="text-xs leading-snug text-[var(--muted)]"
          aria-live="polite"
        >
          {missingValue ? (
            messages.samples.fillParameters
          ) : invalidValue ? (
            messages.samples.integerParameters
          ) : previewUpdating ? (
            messages.samples.updatingPreview
          ) : (
            <>
              {model ? (
                <span data-sample-stats className="font-mono tabular-nums">
                  {messages.starter.previewStats(
                    model.nodes.length,
                    model.edges.length,
                  )}{" "}
                  ·{" "}
                  {model.settings.directed
                    ? messages.settings.directed
                    : messages.settings.undirected}
                  {model.settings.weighted
                    ? ` · ${messages.settings.weighted}`
                    : ""}
                </span>
              ) : null}
              {adjustments.length > 0 ? (
                <p data-sample-adjustments className="mt-1">
                  {messages.samples.adjustedParameters(adjustments.join(", "))}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          {parameters.length > 0 ? (
            <Button
              size="sm"
              className="self-start"
              disabled={!parametersChanged}
              aria-label={`${title}: ${messages.samples.resetParameters}`}
              onClick={() => onValuesChange(sample.kind, defaults)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {messages.samples.resetParameters}
            </Button>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={
                missingValue ||
                invalidValue ||
                previewUpdating ||
                copyStatus === "copying"
              }
              aria-label={`${title}: ${messages.samples.copyInput}`}
              aria-description={copyHelp}
              tooltip={copyHelp}
              tooltipSide="top-start"
              onClick={() => {
                void copyInput();
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              <span role="status">
                {copyStatus === "copied"
                  ? messages.common.copied
                  : copyStatus === "failed"
                    ? messages.common.failed
                    : copyStatus === "copying"
                      ? messages.common.copying
                      : messages.samples.copyInput}
              </span>
            </Button>
            <Button
              type="submit"
              disabled={missingValue || invalidValue || previewUpdating}
              aria-label={`${title}: ${messages.samples.sizedCreate}`}
              size="sm"
              variant="secondary"
              className="ml-auto px-3"
            >
              {messages.samples.sizedCreate}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
});

function CardNumberInput({
  parameter,
  label,
  value,
  noticeId,
  onChange,
}: {
  parameter: SampleParameter;
  label: string;
  value: string;
  noticeId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[80px] flex-[1_1_80px] flex-col gap-1">
      <span className={fieldLabel}>{label}</span>
      <TextInput
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={label}
        aria-describedby={noticeId}
        aria-invalid={!/^\d+$/.test(normalizeSampleParameterInput(value))}
        title={`${parameter.min}–${parameter.max}${parameter.step > 1 ? ` (step ${parameter.step})` : ""}`}
        onFocus={selectInputValueOnFocus}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono tabular-nums"
      />
    </label>
  );
}

function selectInputValueOnFocus(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const valueOnFocus = input.value;
  window.requestAnimationFrame(() => {
    if (document.activeElement === input && input.value === valueOnFocus)
      input.select();
  });
}
