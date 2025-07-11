import { html, render } from "lit-html";
import OpenAI from "openai";
import { concatMap, debounceTime, distinctUntilChanged, EMPTY, filter, from, fromEvent, map, merge, mergeWith, Subject, switchMap, tap } from "rxjs";
import type { ApiKey } from "./api-key";
import { decodeBytes } from "./decode-bytes";
import { probToHex } from "./prob-to-hex";
import { scrollToBottom } from "./scroll";

export class CompletionDemo {
  private ac?: AbortController;

  constructor(props: { input: HTMLInputElement; optionContainer: HTMLElement; apiKey: ApiKey }) {
    const input$ = fromEvent(props.input, "input");
    const append$ = new Subject<void>();

    merge(input$, append$)
      .pipe(
        map(() => props.input.value ?? ""),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(async (prompt) => {
          if (!prompt.trim()) return [];

          this.ac?.abort(); // Abort previous request if any
          this.ac = new AbortController();
          const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: props.apiKey.getApiKey(),
          });

          render(null, props.optionContainer); // Clear previous options

          const response = await openai.completions.create(
            {
              model: "gpt-3.5-turbo-instruct",
              prompt,
              max_tokens: 1,
              temperature: 0,
              logprobs: 5,
            },
            { signal: this.ac.signal }
          );

          const options = (response.choices[0].logprobs?.top_logprobs ?? []).at(0) ?? {};
          return Object.entries(options).map(([key, value]) => ({
            token: key,
            probability: value,
          }));
        }),
        tap((options) => {
          render(
            html`
              ${options.map((o) => {
                const { background, text } = probToHex(o.probability);
                return html`<button
                  class="token-option"
                  style="background-color: ${background}; color: ${text};"
                  @click=${() => {
                    props.input.value += o.token;
                    append$.next();
                    props.input.focus();
                  }}
                >
                  <code>${JSON.stringify(o.token).slice(1, -1)}</code>
                </button>`;
              })}
            `,
            props.optionContainer
          );
        })
      )
      .subscribe();
  }
}

export class MultiTokenDemo {
  private ac?: AbortController;

  constructor(props: { input: HTMLInputElement; optionContainer: HTMLElement; apiKey: ApiKey }) {
    const submit$ = new Subject<void>();

    props.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit$.next();
      }
    });

    fromEvent(props.input, "input")
      .pipe(
        tap(() => render(null, props.optionContainer)) // Clear options on input change
      )
      .subscribe();

    merge(submit$)
      .pipe(
        map(() => props.input.value ?? ""),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(async (prompt) => {
          if (!prompt.trim()) return [];

          this.ac?.abort(); // Abort previous request if any
          this.ac = new AbortController();
          const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: props.apiKey.getApiKey(),
          });

          render(null, props.optionContainer); // Clear previous options

          const response = await openai.completions.create(
            {
              model: "gpt-3.5-turbo-instruct",
              prompt,
              max_tokens: 32,
              temperature: 0,
              logprobs: 5,
            },
            { signal: this.ac.signal }
          );

          console.log("Response:", response);

          const options = response.choices[0].logprobs?.top_logprobs ?? [];
          const tokenStream = options.map((option) =>
            Object.entries(option).map(([key, value]) => ({
              token: key,
              probability: value,
            }))
          );
          return tokenStream;
        }),
        switchMap((tokenStream) => from(tokenStream)),
        concatMap(async (options) => {
          render(
            html`
              ${options.map((o) => {
                const { background, text } = probToHex(o.probability);
                return html`<button class="token-option" style="background-color: ${background}; color: ${text};">
                  <code>${JSON.stringify(o.token).slice(1, -1)}</code>
                </button>`;
              })}
            `,
            props.optionContainer
          );

          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay for next token
          props.input.value += options[0].token; // Append the first token to the input
        })
      )
      .subscribe();
  }
}

export class ChatDemo {
  private ac?: AbortController;

  constructor(props: {
    messageInput: HTMLInputElement;
    threadInput: HTMLInputElement;
    optionContainer: HTMLElement;
    apiKey: ApiKey;
    allowEmoji?: boolean;
    stop?: string[];
    delay?: number;
    toolNameInput?: HTMLInputElement;
    toolInputInput?: HTMLInputElement;
    toolOutputInput?: HTMLInputElement;
    simulateToolOutput?: boolean;
  }) {
    const submit$ = new Subject<string>();

    const resumeAfterToolUse$ = new Subject<void>();

    const simulateToolRun$ = new Subject<void>();

    simulateToolRun$
      .pipe(
        switchMap(() => {
          const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: props.apiKey.getApiKey(),
          });

          const toolName = props.toolNameInput!.value.trim();
          const toolInput = props.toolInputInput!.value.trim();

          return from(
            openai.responses
              .create({
                model: "gpt-4.1-mini",
                temperature: 0,
                input: [
                  {
                    role: "developer",
                    content:
                      `You are simulating a function calling of some backend API. Respond with a realistic output in valid JSON. Keep the response small and avoid returning verbose metadata.`.trim(),
                  },
                  {
                    role: "assistant",
                    content: `
Function name: "${toolName}"
Input: ${toolInput}.`.trim(),
                  },
                ],
                text: {
                  format: {
                    type: "json_object",
                  },
                },
              })
              .then((r) => JSON.stringify(JSON.parse(r.output_text)))
              .catch(() => "Error running tool")
          );
        }),
        tap((output) => {
          props.toolOutputInput!.value = output;
          props.threadInput.value = `${props.threadInput.value.trim()}\ntool_output: ${output.trim()}\nobservation: `;
          scrollToBottom(props.threadInput);
          resumeAfterToolUse$.next(); // Resume after tool use
        })
      )
      .subscribe();

    const forceSubmit$ = fromEvent<KeyboardEvent>(props.threadInput, "keydown").pipe(
      filter((e) => e.key === "Enter" && (e.ctrlKey || e.metaKey)),
      mergeWith(resumeAfterToolUse$),
      map(() => props.threadInput.value)
    );

    const toolOutputSubmit$ = props.toolOutputInput
      ? fromEvent<KeyboardEvent>(props.toolOutputInput, "keydown").pipe(
          filter((e) => e.key === "Enter" && (e.ctrlKey || e.metaKey)),
          map(() => props.toolOutputInput!.value),
          filter((output) => output.trim() !== ""),
          tap((output) => {
            props.threadInput.value = `${props.threadInput.value.trim()}\ntool_output: ${output.trim()}\nobservation: `;
            props.toolNameInput!.value = "";
            props.toolInputInput!.value = "";
            props.toolOutputInput!.value = "";
            scrollToBottom(props.threadInput);
          })
        )
      : EMPTY;

    toolOutputSubmit$.subscribe();

    props.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const trimmed = props.messageInput.value.trim();
        if (!trimmed) return;
        submit$.next(trimmed);
        props.messageInput.value = ""; // Clear message input after submission
      }
    });

    const messageCancel$ = fromEvent<KeyboardEvent>(props.messageInput, "keydown").pipe(filter((e) => e.key === "Escape"));
    const threadCancel$ = fromEvent<KeyboardEvent>(props.threadInput, "keydown").pipe(filter((e) => e.key === "Escape"));
    merge(messageCancel$, threadCancel$)
      .pipe(
        tap(() => {
          this.ac?.abort(); // Abort any ongoing request
        })
      )
      .subscribe();

    const inputState = {
      initial: "",
      parts: [] as { type: "text" | "bytes"; value: string }[],
    };

    fromEvent(props.threadInput, "input")
      .pipe(
        tap(() => render(null, props.optionContainer)) // Clear options on input change
      )
      .subscribe();

    merge(submit$)
      .pipe(
        tap((message) => {
          props.threadInput.value = `${props.threadInput.value ? `${props.threadInput.value.trim()}\n\n[User]` : "[User]"}\n${message}\n\n[Assistant]\n`;
          scrollToBottom(props.threadInput, { force: true });
        }),
        map(() => props.threadInput.value ?? ""),
        debounceTime(200),
        distinctUntilChanged(),
        mergeWith(forceSubmit$),
        switchMap(async (prompt) => {
          if (!prompt.trim()) return [];

          this.ac?.abort(); // Abort previous request if any
          this.ac = new AbortController();
          const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: props.apiKey.getApiKey(),
          });

          inputState.initial = props.threadInput.value;
          inputState.parts = []; // Reset bytes state

          render(null, props.optionContainer); // Clear previous options

          const response = await openai.completions.create(
            {
              model: "gpt-3.5-turbo-instruct",
              prompt,
              max_tokens: 1000,
              temperature: 0,
              logprobs: 5,
              stop: props.stop,
            },
            { signal: this.ac.signal }
          );

          console.log("Response:", response);

          const options = response.choices[0].logprobs?.top_logprobs ?? [];
          const selectedTokens = response.choices[0].logprobs?.tokens ?? [];
          const tokenStream = options.map((option) =>
            Object.entries(option).map(([key, value]) => ({
              value: key.startsWith("bytes:") ? key.slice(6) : key,
              type: key.startsWith("bytes:") ? "bytes" : "text",
              isSelected: selectedTokens.includes(key),
              probability: value,
            }))
          );
          return tokenStream;
        }),
        switchMap((tokenStream) => from(tokenStream)),
        concatMap(async (options) => {
          render(
            html`
              ${options.map((o) => {
                const { background, text } = probToHex(o.probability);
                return html`<button class="token-option" style="background-color: ${background}; color: ${text};">
                  <code>${JSON.stringify(o.value).slice(1, -1)}</code>
                </button>`;
              })}
            `,
            props.optionContainer
          );

          await new Promise((resolve) => setTimeout(resolve, props.delay ?? 100)); // Simulate delay for next token
          const selectedToken = options.find((o) => o.isSelected)!;
          const currentType = selectedToken.type as "text" | "bytes";
          if (inputState.parts.at(-1)?.type === currentType) {
            inputState.parts.at(-1)!.value += selectedToken.value; // Append to last part
          } else {
            inputState.parts.push({ type: currentType, value: selectedToken.value }); // Start new part
          }

          // match pattern to get tool function call: functionName(args)
          const fnMatch = inputState.parts
            .map((part) => part.value.match(/\w+\(.*\)/))
            .filter(Boolean)
            .at(-1);

          if (props.toolInputInput && props.toolNameInput) {
            const fnName = fnMatch ? fnMatch[0].split("(")[0] : null;
            const fnArgs = fnMatch ? fnMatch[0].slice(fnName!.length + 1, -1) : null;
            if (fnName && fnArgs) {
              props.toolNameInput.value = fnName;
              props.toolInputInput.value = fnArgs;

              if (props.simulateToolOutput) {
                simulateToolRun$.next();
              }
            }
          }

          if (props.allowEmoji) {
            const decoded = inputState.parts.map((part) => (part.type === "bytes" ? decodeBytes(part.value) : part.value)).join("");
            props.threadInput.value = `${inputState.initial}${decoded}`;
          } else {
            props.threadInput.value += selectedToken.value;
          }

          scrollToBottom(props.threadInput);

          this.ac = undefined; // Clear abort controller after request
        })
      )
      .subscribe();
  }
}
