import { ApiKey } from "./api-key";
import { ChatDemo, CompletionDemo, MultiTokenDemo } from "./completion-demo";
import "./style.css";

const apiKey = new ApiKey(document.querySelector("#openaiApiKey") as HTMLInputElement);

new CompletionDemo({
  input: document.querySelector("#completionInput") as HTMLInputElement,
  optionContainer: document.querySelector("#completionOutput") as HTMLElement,
  apiKey,
});

new MultiTokenDemo({
  input: document.querySelector("#multitokenInput") as HTMLInputElement,
  optionContainer: document.querySelector("#multitokenOutput") as HTMLElement,
  apiKey,
});

new ChatDemo({
  threadInput: document.querySelector("#threadInput") as HTMLInputElement,
  messageInput: document.querySelector("#messageInput") as HTMLInputElement,
  optionContainer: document.querySelector("#threadOutput") as HTMLElement,
  apiKey,
});
