import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agriculteur");
  const [msg, setMsg] = useState("");

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    });
    setMsg(error
      ? error.message
      : data.session
        ? "Compte créé et connecté."
        : "Compte créé. Vérifiez votre e-mail pour confirmer l'inscription.");
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
      <label>
        Profil (pour la création du compte)
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="agriculteur">Agriculteur</option>
          <option value="acheteur">Acheteur</option>
        </select>
      </label>
      <button onClick={signIn}>Se connecter</button>
      <button onClick={signUp}>Créer un compte</button>
      <p>{msg}</p>
    </div>
  );
}