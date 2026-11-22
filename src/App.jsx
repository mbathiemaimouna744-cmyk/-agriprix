import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Annonces from "./Annonces";
import Prix from "./Prix";
import AgentIA from "./AgentIA";
import Accueil from "./Accueil";
import TableauBord from "./TableauBord";
import Admin from "./Admin";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [profil, setProfil] = useState(null);
  const [erreurProfil, setErreurProfil] = useState(null);
  const [page, setPage] = useState("accueil");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let actif = true;

    const chargerProfil = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Profil utilisateur introuvable.");
        if (actif) {
          setProfil({ userId: user.id, role: data.role });
          setErreurProfil(null);
        }
      } catch (error) {
        console.error("Impossible de charger le profil:", error);
        if (actif) {
          setErreurProfil({
            userId: user.id,
            message: "Impossible de charger votre profil. Vérifiez la configuration Supabase des rôles.",
          });
        }
      }
    };

    chargerProfil();
    return () => {
      actif = false;
    };
  }, [user]);

  const role = user && profil?.userId === user.id ? profil.role : null;
  const messageErreurProfil =
    user && erreurProfil?.userId === user.id ? erreurProfil.message : "";
  const chargementProfil = Boolean(user && !role && !messageErreurProfil);

  return (
    <div className="app">
      <header>
        <h1>🌾 AgriPrix</h1>
        <nav>
          <button onClick={() => setPage("accueil")}>Accueil</button>
          <button onClick={() => setPage("annonces")}>Annonces</button>
          <button onClick={() => setPage("prix")}>Prix du marché</button>
          <button onClick={() => setPage("ia")}>Assistant IA</button>
          {user && <button onClick={() => setPage("tableau")}>Mon tableau de bord</button>}
          {role === "admin" && <button onClick={() => setPage("admin")}>Administration</button>}
          {user && <button onClick={() => supabase.auth.signOut()}>Déconnexion</button>}
        </nav>
      </header>
      <main>
        {!user && page !== "accueil" && <Auth />}
        {chargementProfil && <p>Chargement de votre profil...</p>}
        {messageErreurProfil && <p role="alert">{messageErreurProfil}</p>}
        {page === "accueil" && <Accueil allerVers={setPage} />}
        {page === "annonces" && <Annonces user={user} role={role} />}
        {page === "prix" && <Prix />}
        {page === "ia" && <AgentIA />}
        {page === "tableau" && <TableauBord user={user} role={role} />}
        {page === "admin" && <Admin user={user} role={role} />}
      </main>
    </div>
  );
}