"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  username: string | null;
  role: string;
  points: number;
};

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("กำลังโหลด...");
  const [loading, setLoading] = useState(false);

  async function loadMembers() {
    if (!supabase) return;

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profile?.role !== "admin") {
      setMessage("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, role, points")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers(data || []);
    setMessage("");
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function adjustCredit(userId: string) {
    if (!supabase || loading) return;

    const amount = Number(amounts[userId]);

    if (!Number.isSafeInteger(amount) || amount === 0) {
      setMessage("กรุณาใส่จำนวนเครดิตที่ถูกต้อง");
      return;
    }

    if (!window.confirm(
      `${amount > 0 ? "เพิ่ม" : "ลด"}เครดิต ${Math.abs(amount)} เครดิต ใช่หรือไม่?`
    )) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("admin_adjust_credit", {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`สำเร็จ! เครดิตคงเหลือ ${data}`);
      setAmounts((old) => ({ ...old, [userId]: "" }));
      await loadMembers();
    }

    setLoading(false);
  }

  const filtered = members.filter((member) =>
    `${member.username || ""} ${member.id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main style={{
      minHeight: "100vh",
      background: "#100d19",
      color: "white",
      padding: "32px 16px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <h1 style={{ color: "#b58aff" }}>DUDSHOP777 ADMIN</h1>
        <p>ระบบจัดการเครดิตสมาชิก</p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อสมาชิกหรือ User ID"
          style={inputStyle}
        />

        {message && <p>{message}</p>}

        {filtered.map((member) => (
          <section key={member.id} style={cardStyle}>
            <h3>{member.username || "ไม่มีชื่อสมาชิก"}</h3>
            <p>สิทธิ์: {member.role}</p>
            <p>เครดิตปัจจุบัน: <b>{member.points}</b></p>
            <p style={{ fontSize: 12, color: "#aaa" }}>
              User ID: {member.id}
            </p>

            <input
              type="number"
              value={amounts[member.id] || ""}
              onChange={(e) =>
                setAmounts((old) => ({
                  ...old,
                  [member.id]: e.target.value
                }))
              }
              placeholder="จำนวนเครดิต เช่น 100 หรือ -50"
              style={inputStyle}
            />

            <button
              disabled={loading}
              onClick={() => adjustCredit(member.id)}
              style={buttonStyle}
            >
              เพิ่ม / ลดเครดิต
            </button>
          </section>
        ))}
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 12,
  margin: "10px 0",
  borderRadius: 8,
  border: "1px solid #51436b",
  background: "#211a30",
  color: "white"
};

const cardStyle = {
  background: "#1b1528",
  border: "1px solid #49365f",
  borderRadius: 12,
  padding: 18,
  marginTop: 16
};

const buttonStyle = {
  background: "#8b5cf6",
  color: "white",
  padding: "12px 18px",
  border: 0,
  borderRadius: 8,
  cursor: "pointer"
};
