import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : "Compte créé, vous êtes connecté.");
  };
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMsg(error ? error.message : "");
  };

  return (
    <div className="card">
      <h2>Connexion / Inscription</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Mot de passe (6 caractères min.)"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn}>Se connecter</button>
      <button onClick={signUp}>Créer un compte</button>
      <p>{msg}</p>
    </div>
  );
}