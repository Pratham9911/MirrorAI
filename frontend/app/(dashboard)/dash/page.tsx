"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getSessionUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        console.log("No session found");
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.log(error);
      } else {
        setUser(data.user);
      }
    };

    getSessionUser();
  }, []);

  if (!user) return <p>Loading or not logged in...</p>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Email: {user.email}</p>
    </div>
  );
}