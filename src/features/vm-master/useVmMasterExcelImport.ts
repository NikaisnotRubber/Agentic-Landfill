import { computed, readonly, shallowRef } from "vue";

import {
  executeVmMasterExcelImport as executeImportApi,
  previewVmMasterExcelImport as previewImportApi,
} from "./api";
import type {
  VmMasterExcelImportMapping,
  VmMasterExcelImportSummary,
  VmMasterExcelPreviewResult,
} from "./types";
import { useAsyncTask } from "./useAsyncTask";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function useVmMasterExcelImport(options: { refreshPreview: () => Promise<void> }) {
  const task = useAsyncTask();
  const fileName = shallowRef("");
  const workbookBase64 = shallowRef("");
  const preview = shallowRef<Extract<VmMasterExcelPreviewResult, { ok: true }> | null>(null);
  const mapping = shallowRef<VmMasterExcelImportMapping>({});
  const summary = shallowRef<VmMasterExcelImportSummary | null>(null);
  const showOverlay = computed(() => Boolean(preview.value));

  async function previewFile(file: File): Promise<void> {
    preview.value = null;
    mapping.value = {};
    summary.value = null;

    const result = await task.run(async () => {
      fileName.value = file.name;
      workbookBase64.value = await fileToBase64(file);
      return previewImportApi({ fileName: file.name, workbookBase64: workbookBase64.value });
    }, "Failed to preview VM Master Excel import");
    if (!result) {
      return;
    }

    if (!result.ok) {
      task.setError(result.error);
      return;
    }

    preview.value = result;
    mapping.value = { ...result.defaultMapping };
  }

  function closeOverlay(): void {
    preview.value = null;
    mapping.value = {};
  }

  async function executeImport(): Promise<void> {
    const result = await task.run(
      () =>
        executeImportApi({
          fileName: fileName.value,
          workbookBase64: workbookBase64.value,
          mapping: mapping.value,
        }),
      "Failed to import VM Master Excel",
    );
    if (!result) {
      return;
    }

    if (!result.ok) {
      task.setError(result.error);
      return;
    }

    summary.value = result.summary;
    closeOverlay();
    await options.refreshPreview();
  }

  return {
    loading: task.loading,
    error: task.error,
    preview: readonly(preview),
    mapping,
    summary: readonly(summary),
    showOverlay,
    previewFile,
    closeOverlay,
    executeImport,
  };
}