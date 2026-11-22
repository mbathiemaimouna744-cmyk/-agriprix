import { useState } from "react";

function detecterLangue(text) {
  const motsWolof = [
    "naka", "nanga", "nañ", "nanu", "lan", "nak", "def", "yoon",
    "ba", "ci", "nga", "ndax", "fan", "kañ", "jënd", "jigéen",
    "wëñ", "nekk", "xam", "bëgg", "looy", "mana", "dina",
  ];
  const mots = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-zA-ZÀ-ÿ]+/)
    .filter(Boolean);
  return motsWolof.some((mot) => mots.includes(mot)) ? "wolof" : "fr";
}

export default function AgentIA() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [chargement, setChargement] = useState(false);

  const envoyer = async () => {
    const questionEnvoyee = question.trim();
    if (!questionEnvoyee || chargement) return;
    setMessages((m) => [...m, { role: "user", text: questionEnvoyee }]);
    setChargement(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionEnvoyee,
          history,
          language: detecterLangue(questionEnvoyee),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.reponse || "Le service est temporairement indisponible.");
      }
      if (typeof data.reponse !== "string" || !data.reponse.trim()) {
        throw new Error("L'assistant n'a pas fourni de réponse.");
      }
      const reponse = data.reponse.trim();
      setMessages((m) => [...m, { role: "ia", text: reponse }]);
      setHistory((h) => [
        ...h,
        { role: "user", text: questionEnvoyee },
        { role: "assistant", text: reponse },
      ].slice(-10));
    } catch (error) {
      console.error("Erreur lors de l'envoi à l'assistant:", error);
      setMessages((m) => [...m, {
        role: "ia",
        text: error instanceof Error
          ? error.message
          : "Le service est temporairement indisponible. Réessayez.",
      }]);
    } finally {
      setQuestion("");
      setChargement(false);
    }
  };

  const nouvelleDiscussion = () => {
    setMessages([]);
    setHistory([]);
  };

  return (
    <div className="card">
      <h2>🤖 Assistant IA agricole</h2>
      <p>L'assistant garde le contexte des 5 derniers échanges pendant cette discussion.</p>
      <div className="chat">
        {messages.map((m, i) => (
          <p key={i} className={m.role}>
            <b>{m.role === "user" ? "Vous" : "IA"} :</b> {m.text}
          </p>
        ))}
        {chargement && <p>L'IA réfléchit...</p>}
      </div>
      {messages.length > 0 && (
        <button type="button" onClick={nouvelleDiscussion} disabled={chargement}>
          Nouvelle discussion
        </button>
      )}
      <input placeholder="Ex : Quand vendre les oignons ou faut-il les stocker ?"
        value={question} onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && envoyer()} disabled={chargement} />
      <button onClick={envoyer} disabled={chargement || !question.trim()}>
        {chargement ? "Envoi..." : "Envoyer"}
      </button>
    </div>
  );
}