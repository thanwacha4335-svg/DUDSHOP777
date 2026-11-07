
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!supabase) {
        setChecking(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        setIsAdmin(data?.role === "admin");
      }

      setChecking(false);
    }

    checkAdmin();
  }, []);

  async function signIn() {
    if (!supabase) return setMessage("กรุณาตั้งค่า Supabase ก่อน");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) return setMessage(error.message);

    router.push("/dashboard");
  }

  async function signUp() {
    if (!supabase) return setMessage("กรุณาตั้งค่า Supabase ก่อน");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);
    setMessage(error ? error.message : "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมล");
  }

  async function forgotPassword() {
    if (!supabase) return setMessage("กรุณาตั้งค่า Supabase ก่อน");
    if (!email.trim()) return setMessage("กรุณากรอกอีเมลก่อน");

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    setMessage(
      error
        ? error.message
        : "ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบอีเมล"
    );
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span>DUD</span>SHOP777</div>
        <span className="tag">KEY STORE</span>
      </nav>

      {isAdmin && !checking && (
        <div style={{ textAlign: "right", marginTop: 20 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{
              background: "#b91c1c",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "12px 20px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            ⚙️ จัดการร้านค้า
          </button>
        </div>
      )}

      <section className="hero">
        <p className="eyebrow">WELCOME TO DUDSHOP777</p>
        <h1>KEY <span>GENERATOR</span></h1>
        <p className="sub">
          ระบบจัดการสินค้า คีย์ และเครดิตสมาชิกในที่เดียว
        </p>

        <div className="panel">
          <h2>เข้าสู่ระบบ / สมัครสมาชิก</h2>

          <label>อีเมล</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label>รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
          />

          <div className="actions">
            <button onClick={signIn} disabled={loading}>
              เข้าสู่ระบบ
            </button>
            <button className="secondary" onClick={signUp} disabled={loading}>
              สมัครสมาชิก
            </button>
          </div>

          <button
            className="secondary"
            onClick={forgotPassword}
            disabled={loading}
            style={{ marginTop: 12, width: "100%" }}
          >
            ลืมรหัสผ่าน?
          </button>

          {message && <p className="message">{message}</p>}
        </div>
      </section>

      <footer>© 2026 DUDSHOP777</footer>
    </main>
  );
}
