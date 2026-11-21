import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Annonces from "./Annonces";
import Prix from "./Prix";
import AgentIA from "./AgentIA";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("annonces");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>🌾 AgriPrix</h1>
        <nav>
          <button onClick={() => setPage("annonces")}>Annonces</button>
          <button onClick={() => setPage("prix")}>Prix du marché</button>
          <button onClick={() => setPage("ia")}>Assistant IA</button>
          {user && <button onClick={() => supabase.auth.signOut()}>Déconnexion</button>}
        </nav>
      </header>
      <main>
        {!user && <Auth />}
        {page === "annonces" && <Annonces user={user} />}
        {page === "prix" && <Prix />}
        {page === "ia" && <AgentIA />}
      </main>
    </div>
  );
}