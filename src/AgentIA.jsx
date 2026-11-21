import { useState } from "react";

export default function AgentIA() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(false);

  const envoyer = async () => {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setChargement(true);
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json().catch(() => ({}));
      const reponse = data.reponse || (r.ok
        ? "Pas de réponse."
        : "Le service est temporairement indisponible.");
      setMessages((m) => [...m, { role: "ia", text: reponse }]);
    } catch {
      setMessages((m) => [...m, { role: "ia", text: "Erreur, réessayez." }]);
    } finally {
      setQuestion("");
      setChargement(false);
    }
  };

  return (
    <div className="card">
      <h2>🤖 Assistant IA agricole</h2>
      <div className="chat">
        {messages.map((m, i) => (
          <p key={i} className={m.role}>
            <b>{m.role === "user" ? "Vous" : "IA"} :</b> {m.text}
          </p>
        ))}
        {chargement && <p>L'IA réfléchit...</p>}
      </div>
      <input placeholder="Ex : À combien vendre 50 kg d'oignons à Thiès ?"
        value={question} onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && envoyer()} />
      <button onClick={envoyer}>Envoyer</button>
    </div>
  );
}