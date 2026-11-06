
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    if (!supabase) {
      setMessage("กรุณาตั้งค่า Supabase ก่อน");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setMessage(error ? error.message : "เข้าสู่ระบบสำเร็จ");
  }

  async function signUp() {
    if (!supabase) {
      setMessage("กรุณาตั้งค่า Supabase ก่อน");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setMessage(error ? error.message : "สมัครสมาชิกสำเร็จ");
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span>DUD</span>SHOP777</div>
        <span className="tag">KEY STORE</span>
      </nav>

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
            <button onClick={signIn}>เข้าสู่ระบบ</button>
            <button className="secondary" onClick={signUp}>
              สมัครสมาชิก
            </button>
          </div>
          {message && <p className="message">{message}</p>}
        </div>
      </section>

      <footer>© 2026 DUDSHOP777</footer>
    </main>
  );
}
