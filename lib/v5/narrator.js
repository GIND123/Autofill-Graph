(function initAutoFillGraphV5Narrator(root) {
  "use strict";

  const Utils = root.AutoFillGraphV5Utils;

  if (!Utils) throw new Error("Load utils.js before narrator.js");

  // ── Narrator ──────────────────────────────────────────────────────────────
  // Long-form QA from knowledge graph facts (mirrors Prototype5 answer_question).
  // Retrieves relevant KG triples, prompts Mistral with word-count window,
  // and runs one revision pass if the answer is out of window.

  const SYS_PROMPT = (
    "You are filling in a form answer from verified personal data. " +
    "Answer ONLY from the provided memory. Never fabricate. " +
    "Be fluent, precise, and respect the requested word-count window."
  );

  class Narrator {
    constructor(llmClient, retriever) {
      this.llm       = llmClient;
      this.retriever = retriever;
    }

    // ── answerQuestion(question, maxWords) → {answer, context} ────────────

    async answerQuestion(question, maxWords = 60) {
      if (!this.llm.available()) {
        const ctx = this.retriever.retrieve([question], 6);
        return {
          answer: `LLM unavailable. Relevant facts: ${ctx.map(x => x.triple).slice(0, 3).join("; ")}`,
          context: ctx.map(x => x.triple)
        };
      }

      const retrieved = this.retriever.retrieve([question], 12);
      const ctx = retrieved.map(x => x.triple);
      const loW = Math.max(5, Math.floor(maxWords * 0.85));
      const hiW = Math.max(loW, Math.ceil(maxWords * 1.15));

      const userPrompt = [
        `Question / field label: ${question}`,
        `Target length: ${loW}–${hiW} words, ideal ${maxWords}.`,
        ``,
        `User memory (${ctx.length} retrieved facts):`,
        ...ctx.map(t => `  - ${t}`),
        ``,
        `Write ${loW}–${hiW} words. Do not exceed ${hiW} words. Plain text only, no JSON.`
      ].join("\n");

      let answer = await this.llm.chatText(userPrompt, SYS_PROMPT);
      const wc = answer.split(/\s+/).length;

      // One revision pass if out of window
      if (answer && this.llm.available() && (wc < loW || wc > hiW)) {
        const direction = wc < loW ? "expand" : "shorten";
        const elaboration = wc < loW
          ? "Elaborate with context: role, institution, location, skills — draw ONLY from memory.\n"
          : "";
        const revisePrompt = [
          `The answer below has ${wc} words but the required window is ${loW}–${hiW} words (ideal: ${maxWords}).`,
          `You MUST ${direction} it to fit within ${loW}–${hiW} words.`,
          elaboration,
          `Stay factual. Use ONLY facts listed in the memory below. Do not invent any claims.`,
          ``,
          `Question: ${question}`,
          `Memory:`,
          ...ctx.map(t => `  - ${t}`),
          ``,
          `Current answer (${wc} words):`,
          answer,
          ``,
          `Rewritten answer (${loW}–${hiW} words):`
        ].join("\n");
        const revised = await this.llm.chatText(revisePrompt, SYS_PROMPT);
        if (revised && revised.split(/\s+/).length >= loW) answer = revised.trim();
      }

      return { answer: answer.trim(), context: ctx };
    }
  }

  const api = Object.freeze({ Narrator });

  root.AutoFillGraphV5Narrator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
