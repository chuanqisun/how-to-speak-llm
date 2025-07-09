export class ApiKey {
  constructor(input: HTMLInputElement) {
    input.value = this.getApiKey();
    input.addEventListener("change", () => {
      this.setApiKey(input.value);
    });
  }

  getApiKey() {
    return localStorage.getItem("openai-api-key") ?? "";
  }

  setApiKey(apiKey: string) {
    localStorage.setItem("openai-api-key", apiKey);
  }
}
