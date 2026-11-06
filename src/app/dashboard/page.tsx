
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [role, setRole] = useState("user");

  useEffect(() => {
    async function loadProfile() {
      if (!supabase) {
        router.replace("/");
        return;
      }

      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, role, points")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
      }

      if (data) {
        setUsername(data.username || user.email || "สมาชิก");
        setPoints(Number(data.points || 0));
        setRole(data.role || "user");
      } else {
        setUsername(user.email || "สมาชิก");
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return <main className="shell">กำลังโหลดข้อมูล...</main>;
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span>DUD</span>SHOP777</div>
        <button onClick={logout}>ออกจากระบบ</button>
      </nav>

      <section className="hero">
        <p className="eyebrow">MEMBER DASHBOARD</p>
        <h1>WELCOME <span>BACK</span></h1>
        <p className="sub">ยินดีต้อนรับ {username}</p>

        <div className="panel">
          <h2>ข้อมูลสมาชิก</h2>
          <p>ชื่อสมาชิก: {username}</p>
          <p>เครดิตคงเหลือ: {points.toLocaleString("th-TH")}</p>
          <p>สถานะบัญชี: {role}</p>
        </div>

        <div className="panel">
          <h2>เมนูสมาชิก</h2>
          <p>ระบบสินค้าและสร้างคีย์จะเพิ่มในขั้นตอนถัดไป</p>
        </div>
      </section>

      <footer>© 2026 DUDSHOP777</footer>
    </main>
  );
}
