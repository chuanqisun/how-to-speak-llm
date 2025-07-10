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
  allowEmoji: true,
  stop: ["[User]"],
});

new ChatDemo({
  threadInput: document.querySelector("#cotInput") as HTMLInputElement,
  messageInput: document.querySelector("#cotMessageInput") as HTMLInputElement,
  optionContainer: document.querySelector("#cotOutput") as HTMLElement,
  apiKey,
  stop: ["[User]"],
});

new ChatDemo({
  threadInput: document.querySelector("#reActInput") as HTMLInputElement,
  messageInput: document.querySelector("#reActMessageInput") as HTMLInputElement,
  optionContainer: document.querySelector("#reActOutput") as HTMLElement,
  toolNameInput: document.querySelector("#reActToolName") as HTMLInputElement,
  toolInputInput: document.querySelector("#reActToolInput") as HTMLInputElement,
  toolOutputInput: document.querySelector("#reActToolOutput") as HTMLInputElement,
  apiKey,
  delay: 50,
  stop: ["[User]", "tool_output"],
});

new ChatDemo({
  threadInput: document.querySelector("#agentInput") as HTMLInputElement,
  messageInput: document.querySelector("#agentMessageInput") as HTMLInputElement,
  optionContainer: document.querySelector("#agentOutput") as HTMLElement,
  toolNameInput: document.querySelector("#agentToolName") as HTMLInputElement,
  toolInputInput: document.querySelector("#agentToolInput") as HTMLInputElement,
  toolOutputInput: document.querySelector("#agentToolOutput") as HTMLInputElement,
  apiKey,
  delay: 50,
  simulateToolOutput: true,
  stop: ["[User]", "tool_output"],
});
