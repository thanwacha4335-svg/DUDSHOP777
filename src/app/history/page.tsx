
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type HistoryItem = {
  id: string;
  product_name: string;
  duration: string;
  key_value: string;
  price_points: number;
  created_at: string;
};

export default function HistoryPage() {
  const router = useRouter();

  const [username, setUsername] = useState("สมาชิก");
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showKeys, setShowKeys] = useState<string[]>([]);

  async function loadHistory() {
    if (!supabase) return;

    setHistoryLoading(true);
    setMessage("");

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("generated_keys")
      .select("id, product_name, duration, key_value, price_points, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    setHistoryLoading(false);

    if (error) {
      setMessage("โหลดประวัติไม่สำเร็จ: " + error.message);
      return;
    }

    setHistory(data || []);
  }

  async function start() {
    if (!supabase) {
      router.replace("/");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username, points")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (error) {
      setMessage("โหลดข้อมูลสมาชิกไม่สำเร็จ: " + error.message);
    } else {
      setUsername(data?.username || auth.user.email || "สมาชิก");
      setPoints(Number(data?.points || 0));
    }

    await loadHistory();
    setLoading(false);
  }

  useEffect(() => {
    start();
  }, []);

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("คัดลอก KEY สำเร็จ");
    } catch {
      setMessage("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  function toggleKey(id: string) {
    setShowKeys((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

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
        <div className="brand">
          <span>DUD</span>SHOP777
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard"><button>Dashboard</button></Link>
          <Link href="/key-generator"><button>Key Generator</button></Link>
          <Link href="/history"><button>History</button></Link>
          <button onClick={logout}>ออกจากระบบ</button>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">PURCHASE HISTORY</p>
        <h1>MY <span>HISTORY</span></h1>
        <p className="sub">ประวัติการซื้อ KEY ทั้งหมดของคุณ</p>

        <div className="panel">
          <h2>ข้อมูลสมาชิก</h2>
          <p>ชื่อสมาชิก: {username}</p>
          <p>เครดิตคงเหลือ: {points.toLocaleString("th-TH")}</p>
        </div>

        <div className="panel">
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}>
            <h2>ประวัติการซื้อและ KEY</h2>

            <button onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>
          </div>

          {historyLoading ? (
            <p>กำลังโหลดประวัติ...</p>
          ) : history.length === 0 ? (
            <p>ยังไม่มีประวัติการซื้อ</p>
          ) : (
            history.map((item) => (
              <div key={item.id} style={keyCardStyle}>
                <p><strong>{item.product_name}</strong></p>
                <p>ระยะเวลา: {item.duration}</p>
                <p>
                  ราคา: {Number(item.price_points).toLocaleString("th-TH")} เครดิต
                </p>
                <p>
                  วันที่ซื้อ: {new Date(item.created_at).toLocaleString("th-TH")}
                </p>

                <p style={{ overflowWrap: "anywhere" }}>
                  KEY: {showKeys.includes(item.id) ? item.key_value : "••••••••••••"}
                </p>

                <button onClick={() => toggleKey(item.id)}>
                  {showKeys.includes(item.id) ? "ซ่อน KEY" : "แสดง KEY"}
                </button>

                <button onClick={() => copyKey(item.key_value)}>
                  คัดลอก KEY
                </button>
              </div>
            ))
          )}

          {message && <p className="message">{message}</p>}
        </div>
      </section>

      <footer>© 2026 DUDSHOP777</footer>
    </main>
  );
}

const keyCardStyle = {
  padding: 12,
  marginBottom: 10,
  background: "#211a30",
  borderRadius: 8,
  overflowWrap: "anywhere" as const,
};
