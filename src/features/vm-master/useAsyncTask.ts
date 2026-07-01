import { readonly, shallowRef } from "vue";

export function useAsyncTask() {
  const loading = shallowRef(false);
  const error = shallowRef("");

  function setError(message: string): void {
    error.value = message;
  }

  async function run<T>(work: () => Promise<T>, fallbackMessage = "Request failed"): Promise<T | undefined> {
    loading.value = true;
    error.value = "";

    try {
      return await work();
    } catch (nextError) {
      error.value = nextError instanceof Error ? nextError.message : fallbackMessage;
      return undefined;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    run,
    setError,
  };
}
