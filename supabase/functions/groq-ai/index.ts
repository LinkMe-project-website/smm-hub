import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  try {
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      throw new Error("Missing GROQ_API_KEY secret.");
    }

    const body = await req.json();
    const prompt = String(body && body.prompt ? body.prompt : "").trim();
    const meta = body && body.meta ? body.meta : {};

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required." }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    const systemLines = [
      "You are an AI assistant for SMM Hub.",
      "Always return clean, ready-to-use content.",
      "Keep the output practical and direct.",
      meta && meta.preferredLanguage ? "Preferred language: " + String(meta.preferredLanguage) : null,
      meta && meta.platform ? "Platform: " + String(meta.platform) : null,
      meta && meta.appName ? "App: " + String(meta.appName) : null
    ].filter(Boolean);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + groqApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: systemLines.join("\n")
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const groqJson = await groqResponse.json();

    if (!groqResponse.ok) {
      const apiError = groqJson && groqJson.error && groqJson.error.message
        ? groqJson.error.message
        : "Groq request failed.";
      throw new Error(apiError);
    }

    const text = groqJson &&
      groqJson.choices &&
      groqJson.choices[0] &&
      groqJson.choices[0].message &&
      groqJson.choices[0].message.content
      ? String(groqJson.choices[0].message.content).trim()
      : "";

    return new Response(JSON.stringify({
      text: text,
      model: groqJson && groqJson.model ? groqJson.model : "llama-3.1-8b-instant"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
