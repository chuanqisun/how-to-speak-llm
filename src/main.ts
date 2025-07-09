import OpenAI from "openai";
import { ApiKey } from "./api-key";
import "./style.css";

const apiKey = new ApiKey(document.querySelector("#openaiApiKey") as HTMLInputElement);

const openai = new OpenAI({
  dangerouslyAllowBrowser: true,
});
