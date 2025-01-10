import {
  LLMApi,
  SpeechOptions,
  ChatOptions,
  LLMModel,
  getHeaders,
} from "../api";
import {
  ApiPath,
  XAI_BASE_URL,
  REQUEST_TIMEOUT_MS,
  Dify,
} from "@/app/constant";
import {
  useAccessStore,
  useAppConfig,
  useChatStore,
  ChatMessageTool,
  usePluginStore,
} from "@/app/store";
import { getMessageTextContent } from "@/app/utils";
import { RequestPayload } from "./openai";
import { stream } from "@/app/utils/chat";
import { getClientConfig } from "@/app/config/client";
import { userAccessMemory } from "@/app/store";
export class DifyApi implements LLMApi {
  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.xaiUrl;
    }

    if (baseUrl.length === 0) {
      const isApp = !!getClientConfig()?.isApp;
      const apiPath = ApiPath.Dify;
      baseUrl = isApp ? XAI_BASE_URL : apiPath;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.Dify)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);

    return "/api/dify/" + path;
  }
  async speech(options: SpeechOptions): Promise<ArrayBuffer> {
    console.log("options ", options);
    throw new Error("Method not implemented.");
  }
  async chat(options: ChatOptions) {
    console.log({ options });
    let messages: any[] = [];
    for (const v of options.messages) {
      const content = getMessageTextContent(v);
      if (v.role == "user") {
        messages = [{ role: userAccessMemory.getState().username, content }];
      }
    }

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
        providerName: options.config.providerName,
      },
    };

    const requestPayload = {
      messages,
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
      conversation_id: localStorage.getItem("conversation_id"),
    };
    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);
    try {
      const chatPath = this.path(Dify.ChatPath);
      console.log({ chatPath });
      const chatPayload = {
        method: "POST",
        body: JSON.stringify(options),
        signal: controller.signal,
        headers: getHeaders(),
      };
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS * 10,
      );
      if (shouldStream) {
        const [tools, funcs] = usePluginStore
          .getState()
          .getAsTools(
            useChatStore.getState().currentSession().mask?.plugin || [],
          );
        return stream(
          chatPath,
          requestPayload,
          getHeaders(),
          tools as any,
          funcs,
          controller,
          // parseSSE
          (text: string, runTools: ChatMessageTool[]) => {
            // console.log("parseSSE", text, runTools);
            const json = JSON.parse(text);
            localStorage.setItem("dify_conversation_id", json.conversation_id);
            const choices = json.choices as Array<{
              delta: {
                content: string;
                tool_calls: ChatMessageTool[];
              };
            }>;
            const tool_calls = choices[0]?.delta?.tool_calls;
            if (tool_calls?.length > 0) {
              const index = tool_calls[0]?.index;
              const id = tool_calls[0]?.id;
              const args = tool_calls[0]?.function?.arguments;
              if (id) {
                runTools.push({
                  id,
                  type: tool_calls[0]?.type,
                  function: {
                    name: tool_calls[0]?.function?.name as string,
                    arguments: args,
                  },
                });
              } else {
                // @ts-ignore
                runTools[index]["function"]["arguments"] += args;
              }
            }
            return choices[0]?.delta?.content;
          },
          // processToolMessage, include tool_calls message and tool call results
          (
            requestPayload: RequestPayload,
            toolCallMessage: any,
            toolCallResult: any[],
          ) => {
            // @ts-ignore
            requestPayload?.messages?.splice(
              // @ts-ignore
              requestPayload?.messages?.length,
              0,
              toolCallMessage,
              ...toolCallResult,
            );
          },
          options,
        );
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);

        const resJson = await res.json();
        const message = this.extractMessage(resJson);
        options.onFinish(message, res);
      }
    } catch (error) {}
  }
  async usage() {
    return {
      used: 0,
      total: 0,
    };
  }
  async models(): Promise<LLMModel[]> {
    return [];
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }
}
