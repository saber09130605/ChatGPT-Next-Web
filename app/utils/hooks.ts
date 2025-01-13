import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const models = useMemo(() => {
    return collectModelsWithDefaultModel(
      configStore.models,
      [accessStore.customModels].join(","),
      accessStore.defaultModel,
    );
  }, [accessStore.customModels, accessStore.defaultModel, configStore.models]);
  console.log({ models, accessStore, configStore });
  return models;
}
