import { html, render } from "lit-html";
import OpenAI from "openai";
import { concatMap, debounceTime, distinctUntilChanged, filter, from, fromEvent, map, merge, mergeWith, Subject, switchMap, tap } from "rxjs";
import type { ApiKey } from "./api-key";
import { probToHex } from "./prob-to-hex";

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
  }) {
    const submit$ = new Subject<string>();

    const forceSubmit$ = fromEvent<KeyboardEvent>(props.threadInput, "keydown").pipe(
      filter((e) => e.key === "Enter" && (e.ctrlKey || e.metaKey)),
      map(() => props.threadInput.value)
    );

    props.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const trimmed = props.messageInput.value.trim();
        if (!trimmed) return;
        submit$.next(trimmed);
        props.messageInput.value = ""; // Clear message input after submission
      }
    });

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
        tap(
          (message) => (props.threadInput.value = `${props.threadInput.value ? `${props.threadInput.value}\n\n[User]` : "[User]"}\n${message}\n\n[Assistant]\n`)
        ),
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
              max_tokens: 120,
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

          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay for next token
          const selectedToken = options.find((o) => o.isSelected)!;
          const currentType = selectedToken.type as "text" | "bytes";
          if (inputState.parts.at(-1)?.type === currentType) {
            inputState.parts.at(-1)!.value += selectedToken.value; // Append to last part
          } else {
            inputState.parts.push({ type: currentType, value: selectedToken.value }); // Start new part
          }

          if (props.allowEmoji) {
            const decoded = inputState.parts.map((part) => (part.type === "bytes" ? decodeBytes(part.value) : part.value)).join("");
            props.threadInput.value = `${inputState.initial}${decoded}`;
          } else {
            props.threadInput.value += selectedToken.value;
          }
        })
      )
      .subscribe();
  }
}

function decodeBytes(input: string) {
  try {
    // Remove "bytes:" prefix
    const hexString = input.replace(/^bytes:/, "");

    // Extract ALL hex bytes in sequence
    const hexMatches = hexString.match(/\\x([0-9a-fA-F]{2})/g);

    if (!hexMatches || hexMatches.length === 0) {
      return input;
    }

    // Convert all hex values to bytes
    const bytes = hexMatches.map((hex) => parseInt(hex.replace("\\x", ""), 16));

    // Let TextDecoder handle the variable-length UTF-8 sequences
    const byteArray = new Uint8Array(bytes);
    const decoder = new TextDecoder("utf-8", { fatal: false });

    return decoder.decode(byteArray);
  } catch (error) {
    console.error("Error converting bytes to Unicode:", error);
    return input;
  }
}
